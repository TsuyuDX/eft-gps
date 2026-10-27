import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  base = path.join(root, "public/data"),
  origin = "https://www.tarkovhead.com";
let errors = [];
async function get(url, file) {
  if (fs.existsSync(file)) return;
  for (let n = 0; n < 3; n++)
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw Error(r.status);
      const d = await r.json();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(d));
      return;
    } catch (e) {
      if (n === 2) errors.push({ url, error: e.message });
    }
}
let i = 0;
const items = JSON.parse(fs.readFileSync(path.join(base, "pve/items.json"))),
  quests = JSON.parse(fs.readFileSync(path.join(base, "pve/quests.json"))),
  maps = JSON.parse(fs.readFileSync(path.join(base, "maps.json")));
const jobs = [
  ...quests.map((x) => ["quest", x.normalizedName, "quests"]),
  ...items.map((x) => ["item", x.normalizedName, "items"]),
  ...maps.map((x) => ["map", x.normalizedName, "maps"]),
];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    for (;;) {
      const index = i++,
        j = jobs[index];
      if (!j) return;
      await get(
        `${origin}/api/${j[0]}/${j[1]}?gameMode=pve&locale=ru`,
        path.join(base, "pve", j[2], j[1] + ".json"),
      );
      if (index % 500 === 0)
        console.log("PVE details", index, "/", jobs.length);
    }
  }),
);
const r = await fetch(origin + "/ru/items-tracker/pve");
const html = await r.text();
let tracker;
function walk(x) {
  if (!x || typeof x !== "object") return;
  if (x.fullItemsDataMap)
    tracker = { fullItemsDataMap: x.fullItemsDataMap, itemsData: x.itemsData };
  for (const v of Object.values(x)) walk(v);
}
for (const m of html.matchAll(
  /self.__next_f.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g,
))
  try {
    for (const l of JSON.parse(m[1]).split("\n"))
      try {
        walk(JSON.parse(l.slice(l.indexOf(":") + 1)));
      } catch {}
  } catch {}
if (tracker)
  fs.writeFileSync(
    path.join(base, "pve/tracker.json"),
    JSON.stringify(tracker),
  );
else
  errors.push({
    url: origin + "/ru/items-tracker/pve",
    error: "Tracker data unavailable",
  });
fs.writeFileSync(path.join(base, "pve/report.json"), JSON.stringify(errors));
console.log("PVE DONE", errors.length, "errors");
