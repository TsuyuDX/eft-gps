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
export async function json(url) {
  if (!cache.has(url))
    cache.set(
      url,
      fetch("/data/" + url)
        .then((r) => {
          if (!r.ok) throw Error("Нет локального файла: " + url);
          return r.json();
        })
        .catch((e) => {
          cache.delete(url);
          throw e;
        }),
    );
  return cache.get(url);
}
export async function init(mode = "regular") {
  db.mode = mode;
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
  await Promise.all(keys.map(async (k) => (db[k] = await json(k + ".json"))));
  await loadMode(mode);
}
export async function loadMode(mode) {
  const [items, quests] = await Promise.all([
    json(mode + "/items.json"),
    json(mode + "/quests.json"),
  ]);
  db.items = items;
  db.quests = quests;
  db.mode = mode;
  if (mode === "pve") {
    try {
      db.tracker = await json("pve/tracker.json");
    } catch {
      db.tracker = await json("tracker.json");
    }
  } else db.tracker = await json("tracker.json");
}
export const asset = (u) =>
  db.assets[u] || (u?.startsWith("/assets/") ? u : "/assets/fallback.svg");
export const itemBySlug = (slug) =>
  db.items.find((x) => x.normalizedName === slug);
export function localHref(href) {
  if (!href) return "#/";
  if (href.startsWith("#")) return href;
  let h = href
    .replace(/^https:\/\/www\.tarkovhead\.com/, "")
    .replace(/^\/ru/, "")
    .replaceAll(":mode", db.mode);
  if (h.startsWith("/")) return "#" + h;
  return href;
}
export async function detail(type, slug) {
  const d = await json(
    (db.mode === "pve" ? "pve/" : "") + type + "/" + slug + ".json",
  );
  return d[type === "items" ? "item" : "quest"];
}
