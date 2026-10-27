import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  base = path.join(root, "public/data"),
  assetRoot = path.join(root, "public/assets");
let urls = new Set(),
  mapping = {},
  errors = [];
function walk(x) {
  if (typeof x === "string" && x.startsWith("/api/wiki/image?")) urls.add(x);
  else if (x && typeof x === "object")
    for (const v of Object.values(x)) walk(v);
}
for (const dir of ["quests", "pve/quests"])
  if (fs.existsSync(path.join(base, dir)))
    for (const f of fs.readdirSync(path.join(base, dir)))
      walk(JSON.parse(fs.readFileSync(path.join(base, dir, f))).quest?.guide);
console.log("Wiki guide images", urls.size);
const list = [...urls];
let i = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (;;) {
      const index = i++,
        u = list[index];
      if (!u) return;
      try {
        const filename =
            crypto.createHash("sha256").update(u).digest("hex").slice(0, 24) +
            ".webp",
          file = path.join(assetRoot, filename);
        if (!fs.existsSync(file)) {
          const r = await fetch("https://www.tarkovhead.com" + u, {
            signal: AbortSignal.timeout(12000),
          });
          if (!r.ok) throw Error(r.status);
          fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        }
        mapping[u] = "/assets/" + filename;
      } catch (e) {
        errors.push({ asset: u, error: e.message });
      }
      if (index % 300 === 0) console.log("Guide images", index);
    }
  }),
);
fs.writeFileSync(path.join(base, "wiki-assets.json"), JSON.stringify(mapping));
fs.writeFileSync(path.join(base, "wiki-report.json"), JSON.stringify(errors));
console.log(
  "GUIDES DONE",
  Object.keys(mapping).length,
  "images",
  errors.length,
  "unavailable",
);
