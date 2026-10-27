import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  data = path.join(root, "public/data"),
  file = path.join(data, "assets.json"),
  assets = JSON.parse(fs.readFileSync(file)),
  manifest = JSON.parse(fs.readFileSync(path.join(data, "manifest.json")));
let i = 0;
const pending = manifest.failures.filter(
  (x) => x.asset && !assets[x.asset] && !x.asset.startsWith("/maps/"),
);
await Promise.all(
  Array.from({ length: 5 }, async () => {
    for (;;) {
      const entry = pending[i++];
      if (!entry) return;
      const u = entry.asset;
      let full = u.startsWith("/") ? "https://www.tarkovhead.com" + u : u;
      if (u.startsWith("/api/wiki/image?")) {
        const direct = new URL(
          u,
          "https://www.tarkovhead.com",
        ).searchParams.get("url");
        if (!direct || new URL(direct).hostname !== "static.wikia.nocookie.net")
          continue;
        full = direct;
      }
      try {
        const r = await fetch(full, { signal: AbortSignal.timeout(12000) });
        if (!r.ok || !r.headers.get("content-type")?.startsWith("image/"))
          continue;
        const ext =
          {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/gif": ".gif",
            "image/webp": ".webp",
          }[r.headers.get("content-type").split(";")[0]] || ".webp";
        const name =
          crypto.createHash("sha256").update(u).digest("hex").slice(0, 24) +
          ext;
        fs.writeFileSync(
          path.join(root, "public/assets", name),
          Buffer.from(await r.arrayBuffer()),
        );
        assets[u] = "/assets/" + name;
      } catch {}
    }
  }),
);
manifest.failures = [
  ...new Map(
    manifest.failures
      .filter(
        (x) => !x.asset || (!assets[x.asset] && !x.asset.startsWith("/maps/")),
      )
      .map((x) => [x.asset || x.url, x]),
  ).values(),
];
manifest.counts.assets = Object.keys(assets).length;
fs.writeFileSync(file, JSON.stringify(assets));
fs.writeFileSync(path.join(data, "manifest.json"), JSON.stringify(manifest));
console.log("Unavailable upstream assets", manifest.failures.length);
