import {startGameInfo,refreshGameInfo} from "../public/core/game-info-client.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  sanitizeGameInfo,
  recordState,
  promoGroup,
  seasonRemaining,
  mergeGameInfo,
  INFO_INTERVAL,
} from "../public/core/game-info-model.js";
import {
  steamPublications,
  telegramPublications,
  discoverPublication,
  collectGameInfo,
  applyLifecycleEvidence,
  youtubePublications,
  YOUTUBE_CHANNEL,
} from "../scripts/collect-game-info.mjs";
import { GameInfoService, INFO_FEED_URL } from "../server/game-info.mjs";
import {
  mapColourDefaults,
  normalizeMapColour,
  validMapColour,
} from "../public/core/map-colour-model.js";
import { validWindowSettings } from "../server/window-settings.mjs";
import { parseHTML } from "linkedom";
import { bindMapColour, mapColourFilter } from "../public/core/map-colour.js";
const now = Date.parse("2026-11-12T12:00:00Z"),
  iso = new Date(now).toISOString();
const record = (extra = {}) => ({
  id: "test-event",
  type: "event",
  title: { ru: "Событие", en: "Event" },
  description: { ru: "Описание", en: "Description" },
  source: "https://t.me/escapefromtarkovEN/6963",
  verified: "official",
  publishedAt: "2026-11-11",
  checkedAt: iso,
  startsAt: "2026-11-11",
  active: true,
  confirmationExpiresAt: "2026-11-13T12:00:00Z",
  ...extra,
});
const feed = (records = [record()]) => ({
  version: 1,
  generatedAt: iso,
  lastSuccess: iso,
  records,
  sources: [
    {
      id: "steam",
      name: "Steam",
      url: "https://steamcommunity.com/app/3932890/allnews/",
      status: "connected",
    },
    {
      id: "telegram",
      name: "Telegram",
      url: "https://t.me/escapefromtarkovEN",
      status: "connected",
    },
  ],
});
test("event activity expires conservatively, seasons never invent an hour, promo publication never proves redemption or permanence", () => {
  const event = sanitizeGameInfo(feed()).records[0];
  assert.equal(recordState(event, now), "active");
  assert.equal(recordState(event, now + 2 * 86400000), "unconfirmed");
  assert.equal(recordState({ ...event, endsAt: iso }, now), "archived");
  assert.equal(
    recordState({ ...event, verified: "unverified" }, now),
    "unconfirmed",
  );
  const season = {
    ...event,
    type: "season",
    endsOn: "2026-12-07",
    endsAt: null,
    endTimeConfirmed: false,
  };
  assert.equal(seasonRemaining(season, now), null);
  assert.equal(
    seasonRemaining(
      { ...season, endsAt: "2026-12-07T12:00:00Z", endTimeConfirmed: true },
      now,
    ).days,
    25,
  );
  const promo = sanitizeGameInfo(
    feed([
      record({
        type: "promo",
        code: "TESTCODE",
        permanentConfirmed: false,
        activationVerified: false,
      }),
    ]),
  ).records[0];
  assert.equal(recordState(promo, now), "unverified");
  assert.equal(promoGroup(promo, now), "temporary");
  assert.equal(promoGroup({ ...promo, endsAt: iso }, now), "archive");
  const untrusted = sanitizeGameInfo(
    feed([
      record({
        source: "https://t.me/mrsouer/1234",
        type: "promo",
        code: "TESTCODE",
        verified: "official",
        activationVerified: true,
        permanentConfirmed: true,
      }),
    ]),
  ).records[0];
  assert.equal(untrusted.verified, "unverified");
  assert.equal(untrusted.activationVerified, false);
  assert.equal(untrusted.permanentConfirmed, false);
});
test("information validation rejects unsafe sources/media/links, deduplicates IDs and retains archived records during feed updates", () => {
  const data = sanitizeGameInfo(
    feed([
      record(),
      record(),
      record({ id: "hostile", source: "https://127.0.0.1/private" }),
      record({
        id: "bad-link",
        guide: "javascript:alert(1)",
        image: "https://tracker.invalid/pixel",
      }),
    ]),
  );
  assert.equal(data.records.length, 2);
  assert.equal(data.records[1].guide, null);
  assert.equal(data.records[1].image, null);
  const next = mergeGameInfo(
    sanitizeGameInfo(feed([record({ id: "old", endsAt: "2026-11-01" })])),
    feed(),
  );
  assert.equal(next.records.length, 2);
  assert.equal(
    recordState(
      next.records.find((x) => x.id === "old"),
      now,
    ),
    "archived",
  );
  assert.throws(() =>
    sanitizeGameInfo({ version: 1, records: Array(501).fill(record()) }),
  );
});
test("collector excludes press feeds and Arena, discovers codes as unverified and preserves old records when a source fails", async () => {
  const raw = JSON.stringify({
    appnews: {
      newsitems: [
        {
          feedname: "steam_community_announcements",
          url: "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/123",
          date: 1794484800,
          title: "Patch",
          contents: "#EscapefromTarkov",
        },
        { feedname: "random press", title: "Rumour" },
      ],
    },
  });
  assert.equal(steamPublications(raw).length, 1);
  const html =
    '<div class="tgme_widget_message" data-post="escapefromtarkovEN/123"><div class="tgme_widget_message_text">New event. Promo code: TESTCODE #EscapefromTarkov</div><time>00:20</time><time datetime="2026-11-11T12:00:00Z"></time></div>';
  const posts = telegramPublications(html);
  assert.equal(posts.length, 1);
  const rows = discoverPublication(posts[0], iso);
  assert.equal(rows.find((x) => x.type === "promo").activationVerified, false);
  assert.equal(rows.find((x) => x.type === "event").active, false);
  assert.deepEqual(
    discoverPublication(
      {
        title: "Arena",
        body: "#TarkovArena update",
        url: record().source,
        date: iso,
      },
      iso,
    ),
    [],
  );
  const result = await collectGameInfo(feed(), null, {
    now: iso,
    fetcher: async (url) =>
      url.includes("steampowered")
        ? new Response(raw)
        : new Response("blocked", { status: 403 }),
  });
  assert.equal(
    result.sources.find((x) => x.id === "telegram").status,
    "unavailable",
  );
  assert.ok(result.records.some((x) => x.id === "test-event"));
  assert.equal(result.lastSuccess, iso);
});
test("client information cache is atomic, rate-limited, private and retained after an offline restart", async (t) => {
  const dir = await fs.mkdtemp(
    path.join(process.cwd(), "work/info-cache-test-"),
  );
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, "public/data"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "public/data/game-info.json"),
    JSON.stringify({ ...feed(), generatedAt: "2026-11-11T12:00:00Z" }),
  );
  let requests = 0,
    offline = false,
    clock = now;
  const fetcher = async (url) => {
    assert.equal(url, INFO_FEED_URL);
    requests++;
    if (offline) throw Error("offline");
    return Response.json(feed([record({ id: "new-event" })]));
  };
  const service = new GameInfoService(dir, {
    fetcher,
    clock: () => clock,
    network: true,
  });
  await service.ready;
  await Promise.all([service.check(), service.check()]);
  assert.equal(requests, 1);
  assert.ok(service.payload().data.records.some((x) => x.id === "new-event"));
  await service.check();
  assert.equal(requests, 1);
  offline = true;
  clock += INFO_INTERVAL + 1;
  await service.check();
  assert.equal(service.payload().state.phase, "offline");
  assert.ok(service.payload().data.records.some((x) => x.id === "new-event"));
  const restarted = new GameInfoService(dir, { network: false });
  await restarted.ready;
  assert.ok(restarted.payload().data.records.some((x) => x.id === "new-event"));
});
test("information cache rejects junctions without writing to an unrelated directory", async (t) => {
  const dir = await fs.mkdtemp(path.join(process.cwd(), "work/info-junction-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, "public/data"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "public/data/game-info.json"),
    JSON.stringify(feed()),
  );
  await fs.mkdir(path.join(dir, "userdata"));
  await fs.mkdir(path.join(dir, "outside"));
  await fs.symlink(
    path.join(dir, "outside"),
    path.join(dir, "userdata/game-info"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const service = new GameInfoService(dir, {
    network: true,
    clock: () => now,
    fetcher: async () => Response.json(feed()),
  });
  await service.check();
  assert.equal(service.state.phase, "offline");
  assert.deepEqual(await fs.readdir(path.join(dir, "outside")), []);
});
test("map colour settings are bounded, persist separately and filter only the background canvas variable", () => {
  const values = normalizeMapColour({
    brightness: 120,
    saturation: 110,
    hue: -15,
    contrast: 105,
  });
  assert.equal(validMapColour(values), true);
  assert.equal(
    validWindowSettings({
      version: 1,
      values: { "eftgps-map-colour-v1": JSON.stringify(values) },
    }),
    true,
  );
  assert.equal(validMapColour({ ...values, hue: 999 }), false);
  const { document, window } = parseHTML(
      '<main><div id="map-canvas"><img id="map-image"><div id="markers">unchanged marker</div></div></main>',
    ),
    saved = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
    };
  Object.assign(globalThis, {
    window,
    document,
    localStorage: { getItem: () => JSON.stringify(values) },
  });
  try {
    bindMapColour(document.querySelector("main"), new AbortController().signal);
    assert.equal(
      document
        .querySelector("#map-canvas")
        .style.getPropertyValue("--map-colour-filter"),
      mapColourFilter(values),
    );
    assert.equal(
      document.querySelector("#markers").getAttribute("style"),
      null,
    );
    assert.equal(
      document.querySelector("#markers").textContent,
      "unchanged marker",
    );
    assert.equal(
      normalizeMapColour(null).brightness,
      mapColourDefaults.brightness,
    );
  } finally {
    Object.assign(globalThis, saved);
  }
});

test("only explicit official lifecycle messages confirm activity or completion and a date-only season statement never creates a time",()=>{
 const base=[record({id:"halloween-2026",active:false}),record({id:"kord-breach",type:"season"})];
 const post=(body,date="2026-11-12T10:00:00Z")=>({body,date,url:"https://t.me/escapefromtarkovEN/9999"});
 const active=applyLifecycleEvidence(base,[post("Participate in the Halloween event in #EscapefromTarkov")],iso);assert.equal(recordState(active[0],now),"active");assert.equal(recordState(active[0],now+3*86400000),"unconfirmed");
 const ended=applyLifecycleEvidence(active,[post("The Halloween event has ended.")],iso);assert.equal(recordState(ended[0],now),"archived");
 const season=applyLifecycleEvidence(base,[post("The Kord Breach season will conclude on December 7.")],iso)[1];assert.equal(season.endsOn,"2026-12-07");assert.equal(seasonRemaining(season,now),null);
 const drops=applyLifecycleEvidence(base,[post("Halloween celebrations continue - Twitch Drops")],iso);assert.equal(drops[0].active,false);
});

test("YouTube RSS accepts only the verified Battlestate channel and preserves source identity",()=>{
 const xml=`<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>${YOUTUBE_CHANNEL}</yt:channelId><entry><yt:videoId>abcdefghijk</yt:videoId><title>Escape from Tarkov trailer</title><published>2026-11-11T12:00:00Z</published></entry></feed>`;
 const rows=youtubePublications(xml);assert.equal(rows.length,1);const result=sanitizeGameInfo(feed(discoverPublication(rows[0],iso)));assert.equal(result.records[0].verified,"official");assert.equal(result.records[0].publisher,YOUTUBE_CHANNEL);assert.throws(()=>youtubePublications(xml.replaceAll(YOUTUBE_CHANNEL,"another-channel")));
});

test("YouTube root channel ID may omit UC while video channel IDs retain it",()=>{
 const xml=`<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>${YOUTUBE_CHANNEL.slice(2)}</yt:channelId><entry><yt:videoId>abcdefghijk</yt:videoId><yt:channelId>${YOUTUBE_CHANNEL}</yt:channelId><title>Trailer</title><published>2026-11-11T12:00:00Z</published></entry></feed>`;assert.equal(youtubePublications(xml).length,1);
});

test("manual information refresh accelerates the hourly poll until its result is received",async()=>{
 const saved={fetch:globalThis.fetch,window:globalThis.window,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const scheduled=new Map();let next=0,phase="current",calls=0;
 Object.assign(globalThis,{window:new EventTarget(),fetch:async()=>{calls++;return Response.json({state:{phase},data:feed()});},setTimeout:(fn,delay)=>{const id=++next;scheduled.set(id,{fn,delay});return id;},clearTimeout:id=>scheduled.delete(id)});
 try{startGameInfo();await new Promise(resolve=>setImmediate(resolve));assert.equal([...scheduled.values()][0].delay,INFO_INTERVAL);
  phase="checking";await refreshGameInfo();assert.equal([...scheduled.values()][0].delay,1500);
  const followup=[...scheduled.values()][0];scheduled.clear();phase="current";await followup.fn();assert.equal([...scheduled.values()][0].delay,INFO_INTERVAL);assert.equal(calls,3);
 }finally{Object.assign(globalThis,saved);}
});
