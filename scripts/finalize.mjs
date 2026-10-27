import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  base = path.join(root, "public/data"),
  assetsDir = path.join(root, "public/assets"),
  assetMap = JSON.parse(fs.readFileSync(path.join(base, "assets.json"))),
  manifest = JSON.parse(fs.readFileSync(path.join(base, "manifest.json")));
if (fs.existsSync(path.join(base, "wiki-assets.json")))
  Object.assign(
    assetMap,
    JSON.parse(fs.readFileSync(path.join(base, "wiki-assets.json"))),
  );
const summaries = [];
// The list endpoint omits item IDs; resolve them from the complete local cards.
// Stable IDs connect favorites, tracker counts, and trader inventories.
for (const mode of ["regular", "pve"]) {
  const listFile = path.join(base, mode, "items.json");
  const items = JSON.parse(fs.readFileSync(listFile));
  for (const item of items) {
    const cardFile = path.join(
      base,
      mode === "regular" ? "" : mode,
      "items",
      item.normalizedName + ".json",
    );
    if (fs.existsSync(cardFile))
      item.id = JSON.parse(fs.readFileSync(cardFile)).item.id;
  }
  fs.writeFileSync(listFile, JSON.stringify(items));
}
for (const p of fs.readdirSync(path.join(base, "maps"))) {
  const { map: m } = JSON.parse(fs.readFileSync(path.join(base, "maps", p)));
  summaries.push({
    name: m.name,
    normalizedName: m.normalizedName,
    preview: m.renderedPath || m.svgPath,
    description: m.description,
    duration: m.duration,
    players: m.players,
  });
}
fs.writeFileSync(path.join(base, "maps.json"), JSON.stringify(summaries));
for (const f of ["wiki-report.json", "pve/report.json", "tiles-report.json"])
  if (fs.existsSync(path.join(base, f)))
    manifest.failures.push(...JSON.parse(fs.readFileSync(path.join(base, f))));
manifest.failures = [
  ...new Map(
    manifest.failures
      .filter(
        (x) =>
          !x.asset || (!assetMap[x.asset] && !x.asset.startsWith("/maps/")),
      )
      .map((x) => [x.asset || x.url, x]),
  ).values(),
];
manifest.counts.assets = Object.keys(assetMap).length;
manifest.counts.articles = JSON.parse(
  fs.readFileSync(path.join(base, "articles.json")),
).length;
manifest.counts.pveQuests = JSON.parse(
  fs.readFileSync(path.join(base, "pve/quests.json")),
).length;
fs.writeFileSync(path.join(base, "assets.json"), JSON.stringify(assetMap));
fs.writeFileSync(path.join(base, "manifest.json"), JSON.stringify(manifest));
console.log(
  "FINALIZED",
  manifest.counts,
  "unavailable assets",
  manifest.failures.length,
);
