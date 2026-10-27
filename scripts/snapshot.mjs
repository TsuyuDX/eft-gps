import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = path.join(root, "public/data"),
  assets = path.join(root, "public/assets");
fs.mkdirSync(data, { recursive: true });
fs.mkdirSync(assets, { recursive: true });
const origin = "https://www.tarkovhead.com",
  failures = [];
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    typeof value === "string" ? value : JSON.stringify(value),
  );
};
async function fetchFile(url, file, json = true) {
  if (fs.existsSync(file))
    return json
      ? JSON.parse(fs.readFileSync(file))
      : fs.readFileSync(file, "utf8");
  for (let n = 0; n < 3; n++)
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw Error("HTTP " + r.status);
      const t = await r.text();
      const v = json ? JSON.parse(t) : t;
      write(file, v);
      return v;
    } catch (e) {
      if (n === 2) {
        failures.push({ url, error: e.message });
        return null;
      }
    }
}
async function pool(list, fn, concurrency = 5) {
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (;;) {
        const j = i++;
        if (j >= list.length) return;
        await fn(list[j], j);
      }
    }),
  );
}
function records(s) {
  const out = [];
  for (const m of s.matchAll(
    /self.__next_f.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g,
  ))
    try {
      for (const l of JSON.parse(m[1]).split("\n"))
        try {
          out.push(JSON.parse(l.slice(l.indexOf(":") + 1)));
        } catch {}
    } catch {}
  return out;
}
function walk(x, fn) {
  if (!x || typeof x !== "object") return;
  fn(x);
  for (const v of Object.values(x)) walk(v, fn);
}
const rawDir = path.join(data, "source");
fs.mkdirSync(rawDir, { recursive: true });
const home = await fetchFile(
  origin + "/ru",
  path.join(rawDir, "home.html"),
  false,
);
const links = [
  ...new Set([...home.matchAll(/href="(\/ru[^"?#]*)"/g)].map((x) => x[1])),
];
let catalog = [],
  quests = [],
  maps = [];
for (const mode of ["regular", "pve"]) {
  console.log("Catalog", mode);
  const first = await fetchFile(
    `${origin}/api/item/list?gameMode=${mode}&locale=ru&offset=0&limit=50`,
    path.join(data, mode, "pages/0.json"),
  );
  if (!first?.items) {
    console.log("Mode unavailable", mode);
    continue;
  }
  const pages = Array.from(
    { length: Math.ceil(first.total / 50) },
    (_, i) => i,
  );
  await pool(pages, async (i) => {
    await fetchFile(
      `${origin}/api/item/list?gameMode=${mode}&locale=ru&offset=${i * 50}&limit=50`,
      path.join(data, mode, `pages/${i}.json`),
    );
  });
  const items = pages.flatMap((i) => {
    const f = path.join(data, mode, `pages/${i}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)).items || [] : [];
  });
  write(path.join(data, mode, "items.json"), items);
  const q = await fetchFile(
    `${origin}/api/quest/list?gameMode=${mode}&locale=ru`,
    path.join(data, mode, "quest-list.json"),
  );
  write(path.join(data, mode, "quests.json"), q?.quests || []);
  if (mode === "regular") {
    catalog = items;
    quests = q?.quests || [];
  }
  console.log(mode, items.length, "items", q?.quests?.length, "quests");
}
const mapLinks = links.filter((x) => /^\/ru\/map\/regular\//.test(x));
await pool(mapLinks, async (p) => {
  const slug = p.split("/").at(-1);
  const d = await fetchFile(
    `${origin}/api/map/${slug}?gameMode=regular&locale=ru`,
    path.join(data, "maps", slug + ".json"),
  );
  if (d?.map) maps.push(d.map);
});
write(
  path.join(data, "maps.json"),
  maps.map(
    ({
      name,
      normalizedName,
      imageThumb,
      description,
      duration,
      players,
      image,
    }) => ({
      name,
      normalizedName,
      imageThumb,
      description,
      duration,
      players,
      image,
    }),
  ),
);
console.log("Maps", maps.length);
let lookup = {},
  modifiers = [],
  categories = [];
const articleLinks = links.filter((x) =>
  /^\/ru\/(boss|trader|event|season|news)\//.test(x),
);
const hideoutIndex = await fetchFile(
  origin + "/ru/hideout/regular",
  path.join(rawDir, "hideout.html"),
  false,
);
const hideoutLinks = [
  ...new Set(
    [...hideoutIndex.matchAll(/href="(\/ru\/hideout\/regular\/[^"?#]*)"/g)].map(
      (x) => x[1],
    ),
  ),
];
const articles = [];
await pool([...articleLinks, ...hideoutLinks], async (p) => {
  const s = await fetchFile(
    origin + p,
    path.join(rawDir, p.slice(4).replaceAll("/", "__") + ".html"),
    false,
  );
  if (!s) return;
  for (const r of records(s))
    walk(r, (x) => {
      if (x.value?.hideout && Object.keys(x.value.hideout).length)
        lookup = x.value;
      if (x.modifiers) modifiers = x.modifiers;
      if (x.handbookCategories) categories = x.handbookCategories;
    });
  const title = (s.match(/<title>(.*?)<\/title>/s)?.[1] || p)
    .split(" | ")[0]
    .replace(/ — TarkovHead$/, "");
  const main = s.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
  const key = p.slice(4);
  write(path.join(data, "articles", key.replaceAll("/", "__") + ".json"), {
    path: key,
    title,
    html: main,
  });
  articles.push({ path: key, title, type: key.split("/")[0] });
});
write(path.join(data, "articles.json"), articles);
write(path.join(data, "lookup.json"), lookup);
write(path.join(data, "modifiers.json"), modifiers);
const itemPage = await fetchFile(
  origin + "/ru/item/regular",
  path.join(rawDir, "items.html"),
  false,
);
for (const r of records(itemPage || ""))
  walk(r, (x) => {
    if (x.handbookCategories) categories = x.handbookCategories;
  });
write(path.join(data, "categories.json"), categories);
const trackerHtml = await fetchFile(
  origin + "/ru/items-tracker/regular",
  path.join(rawDir, "tracker.html"),
  false,
);
let tracker = {};
for (const r of records(trackerHtml || ""))
  walk(r, (x) => {
    if (x.fullItemsDataMap)
      tracker = {
        fullItemsDataMap: x.fullItemsDataMap,
        itemsData: x.itemsData,
      };
  });
write(path.join(data, "tracker.json"), tracker);
console.log("Quest details", quests.length);
await pool(
  quests,
  async (q, i) => {
    await fetchFile(
      `${origin}/api/quest/${q.normalizedName}?gameMode=regular&locale=ru`,
      path.join(data, "quests", q.normalizedName + ".json"),
    );
    if (i % 100 === 0) console.log("quests", i);
  },
  5,
);
console.log("Item details", catalog.length);
await pool(
  catalog,
  async (q, i) => {
    await fetchFile(
      `${origin}/api/item/${q.normalizedName}?gameMode=regular&locale=ru`,
      path.join(data, "items", q.normalizedName + ".json"),
    );
    if (i % 500 === 0) console.log("items", i);
  },
  5,
);
const assetMap = {},
  urls = new Set();
function collect(x) {
  if (typeof x === "string") {
    if (
      /^(https:\/\/assets\.tarkov\.dev\/|\/api\/media\/file\/)/.test(x) &&
      !/[{}]/.test(x) &&
      !/-8x\.|-image\.|-base-image\.|-grid-image\./.test(x)
    )
      urls.add(x);
  } else if (x && typeof x === "object")
    for (const [k, v] of Object.entries(x)) {
      if (k === "html") {
        for (const m of v.matchAll(
          /(?:src|href)="(https:\/\/assets\.tarkov\.dev\/[^"<>]+|\/api\/media\/file\/[^"<>]+)"/g,
        ))
          urls.add(m[1].replaceAll("&amp;", "&"));
        for (const m of v.matchAll(/\/api\/media\/file\/[^"<> &]+/g))
          urls.add(m[0]);
      } else collect(v);
    }
}
collect([catalog, quests, maps, lookup, modifiers]);
for (const dir of ["quests", "articles"])
  for (const f of fs.readdirSync(path.join(data, dir)))
    collect(JSON.parse(fs.readFileSync(path.join(data, dir, f))));
urls.add("/logo.png");
urls.add("/_next/static/immutable/media/geist_mono_vf-s.p.0kq4e1146y5_w.woff");
console.log("Assets", urls.size);
await pool(
  [...urls],
  async (u, i) => {
    try {
      const full = u.startsWith("/") ? origin + u : u;
      const ext = path.extname(new URL(full).pathname) || ".webp";
      const name =
        crypto.createHash("sha256").update(u).digest("hex").slice(0, 24) + ext;
      const file = path.join(assets, name);
      if (!fs.existsSync(file)) {
        const r = await fetch(full, { signal: AbortSignal.timeout(60000) });
        if (!r.ok) throw Error("HTTP " + r.status);
        const b = Buffer.from(await r.arrayBuffer());
        fs.writeFileSync(file, b);
      }
      assetMap[u] = "/assets/" + name;
    } catch (e) {
      failures.push({ asset: u, error: e.message });
    }
    if (i % 500 === 0) console.log("assets", i);
  },
  6,
);
write(path.join(data, "assets.json"), assetMap);
const styles = [...home.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((x) => x[1])
  .join("\n");
write(
  path.join(root, "public/reference.css"),
  styles.replace(/url\([^)]*\)/g, "none"),
);
write(path.join(data, "manifest.json"), {
  version: 1,
  savedAt: new Date().toISOString(),
  source: origin,
  counts: {
    items: catalog.length,
    quests: quests.length,
    maps: maps.length,
    articles: articles.length,
    assets: Object.keys(assetMap).length,
  },
  failures,
});
console.log(
  "DONE",
  JSON.stringify({
    items: catalog.length,
    quests: quests.length,
    assets: Object.keys(assetMap).length,
    failures: failures.length,
  }),
);
