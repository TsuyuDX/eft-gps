import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DOMParser, parseHTML } from "linkedom";
import {
  sanitizeGameInfo,
  mergeGameInfo,
} from "../public/core/game-info-model.js";
const STEAM =
  "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=3932890&count=40&maxlength=0&format=json";
const TELEGRAM = "https://t.me/s/escapefromtarkovEN";
export const YOUTUBE_CHANNEL="UC5QGploHhl9_XaxDiHZKamg";
const YOUTUBE="https://www.youtube.com/feeds/videos.xml?channel_id="+YOUTUBE_CHANNEL;
export async function boundedText(url, fetcher = fetch) {
  const response = await fetcher(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "EFTGPS-information-feed/1.0" },
  });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  let size = 0;
  const parts = [];
  for await (const bytes of response.body) {
    size += bytes.length;
    if (size > 2 * 1024 * 1024) throw Error("response-too-large");
    parts.push(Buffer.from(bytes));
  }
  return Buffer.concat(parts).toString("utf8");
}
const plain = (html) =>
  parseHTML(`<div>${String(html).replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi," ")}</div>`)
    .document.querySelector("div")
    .textContent.replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const short = (text) => text.split(/\s+/).slice(0, 20).join(" ");
export function discoverPublication({ title, body, url, date, publisher }, now) {
  if (!title || !body || !Number.isFinite(Date.parse(date))) return [];
  const text = plain(body);
  if(text.replace(/#[A-Za-z0-9_]+/g,"").trim().length<20)return [];
  if(url.startsWith("https://t.me/") && !/#EscapefromTarkov|Kord Breach|infected|Halloween/i.test(text))return [];
  if (text.includes("#TarkovArena") && !text.includes("#EscapefromTarkov"))
    return [];
  const headline = plain(title)
      .split(/\s+/)
      .slice(0, 15)
      .join(" ")
      .slice(0, 200),
    day = date.slice(0, 10),
    hash = crypto
      .createHash("sha256")
      .update(day + "|" + headline.toLowerCase())
      .digest("hex")
      .slice(0, 20);
  const explicitAll =
    /rewards (?:will be |are )?available in all game modes/i.test(text);
  const record = {
    id: "news-" + hash,
    type: "news",
    title: { ru: headline, en: headline },
    description: {
      ru: short(text).split(/\s+/).slice(0, 10).join(" "),
      en: short(text).split(/\s+/).slice(0, 10).join(" "),
    },
    source: url,
    publisher:publisher||null,
    verified: "official",
    publishedAt: date,
    checkedAt: now,
    modes: explicitAll ? ["pvp", "pve", "season"] : [],
    category: /patch|update|обновлен|патч/i.test(text)
      ? "update"
      : /event|halloween|drops|событи/i.test(text)
        ? "event"
        : "news",
  };
  const result = [record];
  // A publication is evidence of publication, not evidence that a code still redeems.
  for (const match of text.matchAll(
    /(?:promo(?:tional)?\s*code|промокод)\s*[:—-]?\s*([A-Z][A-Z0-9_-]{5,63})\b/gi,
  )) {
    const code = match[1];
    if(code !== code.toUpperCase()) continue;
    if (["TARKOV", "YOUTUBE", "TWITCH", "REDEEM", "OFFICIAL"].includes(code))
      continue;
    result.push({
      ...record,
      id: "promo-" + code.toLowerCase().replaceAll("_", "-"),
      type: "promo",
      title: { ru: code, en: code },
      description: {
        ru: "Код обнаружен в публикации. Активация, награда, режимы и срок действия требуют проверки.",
        en: "Code detected in a publication. Redemption, rewards, modes and expiry require verification.",
      },
      code,
      verified: "unverified",
      modes: [],
      activationVerified: false,
      permanentConfirmed: false,
    });
  }
  if (/halloween|event|событие/i.test(headline))
    result.push({
      ...record,
      id: "event-candidate-" + hash,
      type: "event",
      verified: "unverified",
      active: false,
      description: {
        ru: "Найдена публикация о событии. Этапы, награды и текущая активность требуют редакторской проверки.",
        en: "An event publication was found. Steps, rewards and current activity need editorial review.",
      },
    });
  return result;
}
export function steamPublications(raw) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data.appnews?.newsitems))
    throw Error("invalid-steam-feed");
  return data.appnews.newsitems
    .filter(
      (x) =>
        x.feedname === "steam_community_announcements" &&
        typeof x.url === "string" &&
        x.url.startsWith(
          "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/",
        ),
    )
    .map((x) => ({
      title: x.title,
      body: x.contents,
      url: x.url,
      date: new Date(x.date * 1000).toISOString(),
    }));
}
export function telegramPublications(html) {
  const { document } = parseHTML(html);
  const rows = [
    ...document.querySelectorAll(".tgme_widget_message[data-post]"),
  ];
  if (!rows.length) throw Error("unavailable-telegram-feed");
  return rows
    .filter((e) =>
      /^escapefromtarkovEN\/[0-9]+$/.test(e.getAttribute("data-post")),
    )
    .map((e) => {
      const body =
          e.querySelector(".tgme_widget_message_text")?.innerHTML || "",
        text = plain(body);
      return {
        title: text.split(/(?<=[.!?])\s|[\r\n]/)[0]?.slice(0, 160),
        body,
        url: "https://t.me/" + e.getAttribute("data-post"),
        date: e.querySelector("time[datetime]")?.getAttribute("datetime"),
      };
    });
}
export function youtubePublications(xml){
 const document=new DOMParser().parseFromString(xml,"text/xml");
 const channel=document.getElementsByTagName("yt:channelId")[0]?.textContent;
 if(channel!==YOUTUBE_CHANNEL && channel!==YOUTUBE_CHANNEL.slice(2))throw Error("unexpected-youtube-channel");
 return [...document.querySelectorAll("entry")].map(entry=>{
  const id=entry.getElementsByTagName("yt:videoId")[0]?.textContent;if(!/^[a-zA-Z0-9_-]{11}$/.test(id||""))return null;
  const title=entry.querySelector("title")?.textContent||"";
  return {title,body:title+" "+(entry.getElementsByTagName("media:description")[0]?.textContent||""),date:entry.querySelector("published")?.textContent,url:"https://www.youtube.com/watch?v="+id,publisher:YOUTUBE_CHANNEL};
 }).filter(Boolean);
}
export function applyLifecycleEvidence(records,publications,now){
 const result=records.map(x=>({...x}));
 for(const post of publications.filter(p=>p.url?.startsWith("https://t.me/escapefromtarkovEN/") && Number.isFinite(Date.parse(p.date))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))){
  const body=plain(post.body),halloween=result.find(x=>x.id==="halloween-2026");
  if(halloween && /(?:participate in the Halloween event|Halloween event (?:is|remains) (?:live|active|ongoing))/i.test(body)){
   halloween.active=true;halloween.endedConfirmed=false;halloween.confirmationExpiresAt=new Date(Date.parse(post.date)+48*3600000).toISOString();halloween.activitySource=post.url;halloween.checkedAt=now;
  }
  if(halloween && /Halloween event (?:has )?(?:ended|concluded|is over)/i.test(body)){
   halloween.active=false;halloween.endedConfirmed=true;halloween.activitySource=post.url;halloween.checkedAt=now;
  }
  const match=body.match(/Kord Breach season will conclude on December (\d{1,2})\b/i),season=result.find(x=>x.id==="kord-breach");
  if(match && season && Number(match[1])>=1 && Number(match[1])<=31){season.endsOn=post.date.slice(0,4)+"-12-"+match[1].padStart(2,"0");season.endsAt=null;season.endTimeConfirmed=false;season.activitySource=post.url;season.checkedAt=now;}
 }
 return result;
}
export async function collectGameInfo(
  seed,
  previous,
  { fetcher = fetch, now = new Date().toISOString() } = {},
) {
  const base = mergeGameInfo(
      sanitizeGameInfo(previous || seed),
      sanitizeGameInfo(seed),
    ),
    records = [],
    publications = [],
    sources = base.sources.map((x) => ({ ...x }));
  let successes = 0;
  for (const [id, url, parse] of [
    ["steam", STEAM, steamPublications],
    ["telegram", TELEGRAM, telegramPublications],
    ["youtube",YOUTUBE,youtubePublications],
  ]) {
    const source = sources.find((x) => x.id === id);
    if (!source) continue;
    try {
      const items = parse(await boundedText(url, fetcher));
      publications.push(...items);
      for (const row of items) records.push(...discoverPublication(row, now));
      source.status = "connected";
      source.reason = {
        ru: "Лента успешно проверена.",
        en: "Feed checked successfully.",
      };
      successes++;
    } catch (e) {
      source.status = "unavailable";
      source.reason = {
        ru: `Лента недоступна (${String(e.message).slice(0, 80)}). Ранее загруженные данные сохранены.`,
        en: `Feed unavailable (${String(e.message).slice(0, 80)}). Previously loaded data retained.`,
      };
    }
    source.checkedAt = now;
  }
  const evidenceBase={...base,records:applyLifecycleEvidence(base.records,publications,now)};
  return mergeGameInfo(evidenceBase, {
    version: 1,
    generatedAt: now,
    lastSuccess: successes ? now : base.lastSuccess,
    records,
    sources,
  });
}
async function run() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    seed = JSON.parse(
      await fs.readFile(path.join(root, "public/data/game-info.json"), "utf8"),
    );
  let previous = null;
  const publish = process.argv.includes("--publish"),
    repo = process.env.GITHUB_REPOSITORY;
  const api = async (endpoint, options = {}) => {
    const response = await fetch(
      "https://api.github.com/repos/" + repo + endpoint,
      {
        ...options,
        signal: AbortSignal.timeout(20000),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + process.env.GITHUB_TOKEN,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "EFTGPS-information-feed",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      throw Error("GitHub " + response.status);
    }
    return response.status === 204 ? null : response.json();
  };
  let file = null;
  if (publish) {
    if (repo !== "TsuyuDX/eft-gps" || !process.env.GITHUB_TOKEN)
      throw Error("unexpected-publish-target");
    file = await api("/contents/feed.json?ref=content-feed");
    if (file?.content)
      previous = JSON.parse(
        Buffer.from(file.content, "base64").toString("utf8"),
      );
  }
  const result = await collectGameInfo(seed, previous);
  const output = path.join(root, "work/game-info-feed.json");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n");
  if (publish) {
    let ref = await api("/git/ref/heads/content-feed");
    if (!ref) {
      const main = await api("/git/ref/heads/main");
      await api("/git/refs", {
        method: "POST",
        body: { ref: "refs/heads/content-feed", sha: main.object.sha },
      });
    }
    await api("/contents/feed.json", {
      method: "PUT",
      body: {
        message: "Refresh verified information feeds and review queue",
        branch: "content-feed",
        ...(file?.sha ? { sha: file.sha } : {}),
        content: Buffer.from(JSON.stringify(result) + "\n").toString("base64"),
      },
    });
  }
  console.log(
    JSON.stringify({
      records: result.records.length,
      sources: result.sources.map((x) => ({ id: x.id, status: x.status })),
      lastSuccess: result.lastSuccess,
      published: publish,
    }),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await run();
