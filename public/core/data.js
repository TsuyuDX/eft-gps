import { language } from "./localization.js";
import { contentPath, translateContent } from "./content-language.js";
export const db = {
  mode: "regular",
  items: [],
  quests: [],
  maps: [],
  articles: [],
  assets: {},
  lookup: {},
  categories: [],
  modifiers: [],
  tracker: {},
  manifest: {},
};
const cache = new Map();
export async function json(url, locale = language()) {
  const resolved = await contentPath(url, locale);
  const requested = resolved.url;
  const key = locale + ":" + url;
  if (!cache.has(key))
    cache.set(
      key,
      fetch("/data/" + requested)
        .then((r) => {
          if (!r.ok) throw Error("Нет локального файла: " + url);
          return r.json();
        })
        .then((value) =>
          resolved.pack && !requested.startsWith("en/")
            ? translateContent(value, resolved.pack)
            : value,
        )
        .catch((e) => {
          cache.delete(key);
          throw e;
        }),
    );
  return cache.get(key);
}
export async function init(mode = "regular") {
  const locale = language();
  const keys = [
    "maps",
    "articles",
    "assets",
    "lookup",
    "categories",
    "modifiers",
    "tracker",
    "manifest",
  ];
  const values = await Promise.all(keys.map((k) => json(k + ".json", locale)));
  if (locale !== language()) return false;
  keys.forEach((key, i) => (db[key] = values[i]));
  await loadMode(mode, locale);
  return true;
}
export async function loadMode(mode, locale = language()) {
  const [items, quests] = await Promise.all([
    json(mode + "/items.json", locale),
    json(mode + "/quests.json", locale),
  ]);
  if (locale !== language()) return;
  db.items = items;
  db.quests = quests;
  db.mode = mode;
  if (mode === "pve") {
    try {
      db.tracker = await json("pve/tracker.json", locale);
    } catch {
      db.tracker = await json("tracker.json", locale);
    }
  } else db.tracker = await json("tracker.json", locale);
}
export function asset(u) {
  const value = Object.hasOwn(db.assets, u) ? db.assets[u] : u;
  return typeof value === "string" && /^\/assets\/[A-Za-z0-9_./%()+@-]+$/.test(value) &&
    !value.split("/").some(segment => segment === "." || segment === "..")
    ? value : "/assets/fallback.svg";
}
export const itemBySlug = (slug) =>
  db.items.find((x) => x.normalizedName === slug);
export function localHref(href) {
  if (typeof href !== "string" || /[\u0000-\u0020\u007f]/.test(href)) return "#/";
  if (href.startsWith("#")) return href;
  let h = href
    .replace(/^https:\/\/www\.tarkovhead\.com/, "")
    .replace(/^\/(ru|en)/, "")
    .replaceAll(":mode", db.mode);
  if (h.startsWith("/")) return "#" + h;
  return /^https?:\/\//i.test(href) ? href : "#/";
}
export async function detail(type, slug) {
  const d = await json(
    (db.mode === "pve" ? "pve/" : "") + type + "/" + slug + ".json",
  );
  return d[type === "items" ? "item" : "quest"];
}
