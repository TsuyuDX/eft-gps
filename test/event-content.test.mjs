import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  EventContentService,
  EVENT_CHECK_INTERVAL,
  allowedEventMedia,
  sanitizeEventQuest,
} from "../server/event-content.mjs";
import {
  acceptEventContent,
  resetEventContent,
  eventQuestDetail,
  mergeEventContent,
} from "../public/core/event-content.js";
import { renderGuide } from "../public/features/quest-guide.js";
import { newsEntries, newsPreview } from "../public/features/news.js";
const slug = "halloween-rumors";
function fixture(locale = "ru", extra = "") {
  return {
    quest: {
      id: "quest-cms-76",
      name: locale === "en" ? "Halloween: Rumors" : "Halloween: Слухи",
      normalizedName: slug,
      minPlayerLevel: 1,
      experience: 26000,
      inAllModes: true,
      trader: { name: "Skier", normalizedName: "skier" },
      events: [{ normalizedName: "halloween-2026" }],
      objectives: [
        {
          id: "stable-objective-1",
          description: "Eliminate 10 infected",
          count: 10,
        },
      ],
      taskImageLink: "/api/media/file/banner.png",
      guideCms: {
        root: {
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", text: "Bring magazines. " + extra }],
            },
            {
              type: "link",
              fields: { url: "javascript:alert(1)" },
              children: [{ type: "text", text: "unsafe link" }],
            },
            {
              type: "block",
              fields: {
                blockType: "slider",
                slider: [
                  {
                    image: { url: "/api/media/file/banner.png" },
                    caption: "Reference image",
                  },
                ],
              },
            },
          ],
        },
      },
    },
  };
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
async function directory(t) {
  await fs.mkdir("work", { recursive: true });
  const root = await fs.mkdtemp(path.resolve("work/event-content-test-"));
  assert.ok(root.startsWith(path.resolve("work") + path.sep));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
function source() {
  let calls = 0,
    offline = false,
    extra = "";
  return {
    get calls() {
      return calls;
    },
    set offline(v) {
      offline = v;
    },
    set extra(v) {
      extra = v;
    },
    fetch: async (url, options) => {
      calls++;
      assert.equal(options.redirect, "error");
      if (offline) throw Error("offline");
      const u = new URL(url);
      if (u.pathname === "/api/quest/list")
        return Response.json({ quests: [{ normalizedName: slug }] });
      if (u.pathname.startsWith("/api/quest/"))
        return Response.json(fixture(u.searchParams.get("locale"), extra));
      if (u.pathname === "/api/media/file/banner.png")
        return new Response(png, { headers: { "content-type": "image/png" } });
      throw Error("unexpected request " + url);
    },
  };
}
test("live event updates are atomic, rate-limited, bilingual and reusable after offline restart", async (t) => {
  const root = await directory(t),
    remote = source();
  let clock = 1_000_000;
  const service = new EventContentService(root, {
    fetch: remote.fetch,
    now: () => clock,
  });
  const a = service.check(),
    b = service.check();
  assert.equal(a, b);
  await a;
  assert.equal(service.state.phase, "current");
  assert.ok(service.bundle.quests.ru[slug]);
  assert.ok(service.bundle.quests.en[slug]);
  const revision = service.bundle.revision,
    calls = remote.calls;
  await service.check();
  assert.equal(remote.calls, calls);
  assert.equal(service.payload(revision).unchanged, true);
  const icon = service.bundle.quests.ru[slug].taskImageLink;
  assert.match(icon, /^\/assets\/live-event\/[a-f0-9]{64}\.png$/);
  assert.deepEqual(
    await fs.readFile(await service.asset(path.basename(icon))),
    png,
  );
  assert.equal(await service.asset("../bundle.json"), null);
  remote.extra = "New route description";
  clock += EVENT_CHECK_INTERVAL;
  await service.check();
  assert.notEqual(service.bundle.revision, revision);
  // The cached image was reused; only the list and two locale records were requested.
  assert.equal(remote.calls - calls, 3);
  const good = service.bundle.revision;
  remote.offline = true;
  clock += EVENT_CHECK_INTERVAL;
  await service.check();
  assert.equal(service.state.phase, "offline");
  assert.equal(service.bundle.revision, good);
  const reloaded = new EventContentService(root, { fetch: remote.fetch });
  await reloaded.ready;
  assert.equal(reloaded.bundle.revision, good);
  assert.equal(reloaded.state.phase, "cached");
  assert.equal(
    reloaded.bundle.quests.ru[slug].objectives[0].id,
    "stable-objective-1",
  );
});
test("event provider rejects hostile URLs, other events, executable markup and malformed media", async (t) => {
  for (const url of [
    "http://www.tarkovhead.com/api/media/file/a.png",
    "https://evil.test/image.png",
    "//evil.test/x",
    "/api/wiki/image?url=http://127.0.0.1/",
    "/api/media/file/../x",
    "https://assets.tarkov.dev/a.svg",
  ])
    assert.equal(allowedEventMedia(url), false, url);
  assert.equal(
    allowedEventMedia(
      "/api/wiki/image?url=" +
        encodeURIComponent(
          "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/8/83/Blood_sample_icon.png/revision/latest?cb=20221012065225",
        ),
    ),
    true,
  );
  const raw = fixture();
  raw.quest.objectives[0].id = "__proto__";
  raw.quest.guideCms.root.children.unshift({
    type: "paragraph",
    children: [{ type: "text", text: "<script>alert(1)</script>" }],
  });
  const q = sanitizeEventQuest(raw, slug);
  assert.notEqual(q.objectives[0].id, "__proto__");
  assert.ok(Array.isArray(q.guide));
  const html = renderGuide(q.guide);
  assert.doesNotMatch(html, /<script|href="javascript/);
  assert.match(html, /&lt;script/);
  const erratum = fixture();
  erratum.quest.normalizedName = "halloween-unexpected-help";
  erratum.quest.objectives[0].description = "Stash in room 105";
  erratum.quest.guideCms.root.children = [
    {
      type: "paragraph",
      children: [
        { type: "text", text: "Открывает комнату 205. Opens room 205." },
      ],
    },
  ];
  assert.doesNotMatch(
    renderGuide(sanitizeEventQuest(erratum, "halloween-unexpected-help").guide),
    /205/,
  );
  const other = fixture();
  other.quest.events = [{ normalizedName: "halloween-2024" }];
  assert.throws(() => sanitizeEventQuest(other, slug));
  assert.throws(() => sanitizeEventQuest(fixture(), "../../profile"));
  const root = await directory(t);
  const service = new EventContentService(root, {
    fetch: async (url) =>
      new URL(url).pathname === "/api/quest/list"
        ? Response.json({ quests: [{ normalizedName: slug }] })
        : new URL(url).pathname.startsWith("/api/quest/")
          ? Response.json(fixture())
          : new Response("<html>bad image</html>"),
  });
  await service.check();
  assert.equal(service.bundle, null);
  assert.equal(service.state.phase, "offline");
});
test("event cache refuses directory junctions instead of writing outside its cache", async (t) => {
  const root = await directory(t),
    outside = path.join(root, "outside");
  await fs.mkdir(outside);
  await fs.mkdir(path.join(root, "userdata"));
  await fs.symlink(
    outside,
    path.join(root, "userdata/event-content"),
    "junction",
  );
  const service = new EventContentService(root, {
    fetch: () => {
      throw Error("must not fetch");
    },
  });
  await service.check();
  assert.equal(service.bundle, null);
  assert.deepEqual(await fs.readdir(outside), []);
});
test("downloaded quests merge into search and both lists without deleting existing quests or changing objective IDs", () => {
  resetEventContent();
  try {
    const ru = sanitizeEventQuest(fixture(), slug),
      en = sanitizeEventQuest(fixture("en"), slug);
    const data = {
      format: 1,
      revision: "a".repeat(64),
      quests: { ru: { [slug]: ru }, en: { [slug]: en } },
    };
    assert.equal(
      acceptEventContent({ state: { phase: "current" }, data }),
      true,
    );
    assert.equal(acceptEventContent({ data }), false);
    const base = [{ name: "Debut", normalizedName: "debut" }];
    const merged = mergeEventContent("regular/quests.json", "en", base);
    assert.equal(merged.length, 2);
    assert.equal(base.length, 1);
    assert.equal(merged[1].name, "Halloween: Rumors");
    assert.equal(
      eventQuestDetail("pve/quests/" + slug + ".json", "ru").quest.objectives[0]
        .id,
      "stable-objective-1",
    );
    assert.match(
      mergeEventContent("regular/quest-search.json", "en", {})[slug].text,
      /Bring magazines/,
    );
    assert.equal(eventQuestDetail("quests/debut.json", "ru"), null);
    assert.equal(eventQuestDetail("../userdata/profile.json", "ru"), null);
  } finally {
    resetEventContent();
  }
});
test("news use local application screenshots and official illustrations instead of logo placeholders", async () => {
  for (const entry of newsEntries) {
    assert.match(entry.image, /^\/assets\/news\//);
    assert.ok((await fs.stat("public" + entry.image)).size > 1000);
    const html = newsPreview(entry);
    assert.ok(html.includes(entry.image));
    assert.doesNotMatch(html, /app-192|https?:\/\//);
  }
  assert.doesNotMatch(
    newsPreview({
      image: 'https://evil.test/x" onerror="x',
      title: "Bad",
      kind: "Game",
      label: "1",
    }),
    /evil|onerror/,
  );
});

test("manual and automatic content refresh announce a changed revision exactly once", async () => {
  const { refreshEventContent } =
    await import("../public/core/event-content-client.js");
  const prior = { window: globalThis.window, fetch: globalThis.fetch };
  resetEventContent();
  const target = new EventTarget();
  let changes = 0;
  target.addEventListener("event-content-updated", () => changes++);
  globalThis.window = target;
  const q = sanitizeEventQuest(fixture(), slug);
  globalThis.fetch = async () =>
    Response.json({
      state: { phase: "current" },
      data: {
        revision: "b".repeat(64),
        quests: { ru: { [slug]: q }, en: { [slug]: q } },
      },
    });
  try {
    assert.equal(await refreshEventContent(), true);
    assert.equal(changes, 1);
    assert.equal(await refreshEventContent(), false);
    assert.equal(changes, 1);
  } finally {
    resetEventContent();
    Object.assign(globalThis, prior);
  }
});
