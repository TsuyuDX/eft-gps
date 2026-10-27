import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { mapIconNames } from "../public/core/map-icons.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexFile = path.join(root, "public/data/assets.json");
const index = JSON.parse(await fs.readFile(indexFile, "utf8"));
const urls = new Set(
  Object.values(mapIconNames).map(
    (name) => `https://tarkov.dev/maps/interactive/${name}.png`,
  ),
);
for (const name of [
  "btr-stop-icon.png",
  "btr-icon.png",
  "kord-breach-image-xs.webp",
  "season-1-doc-financial-documentation.webp",
  "season-1-doc-project-documentation.webp",
])
  urls.add("/api/media/file/" + name);
function collect(value) {
  if (!value || typeof value !== "object") return;
  if (value.iconUrl) urls.add(value.iconUrl);
  if (value.iconType)
    urls.add(`/api/media/file/season-1-doc-${value.iconType}.webp`);
  for (const child of Object.values(value))
    if (typeof child === "object") collect(child);
}
for (const dir of ["maps", "pve/maps"]) {
  for (const file of await fs.readdir(path.join(root, "public/data", dir))) {
    if (file.endsWith(".json"))
      collect(
        JSON.parse(
          await fs.readFile(path.join(root, "public/data", dir, file), "utf8"),
        ),
      );
  }
}
let downloaded = 0,
  cursor = 0;
const failures = [],
  queue = [...urls];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (cursor < queue.length) {
      const url = queue[cursor++];
      if (
        index[url] &&
        (await fs.stat(path.join(root, "public", index[url])).catch(() => null))
      )
        continue;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(
            new URL(url, "https://www.tarkovhead.com"),
            { signal: AbortSignal.timeout(30000) },
          );
          if (!response.ok) throw Error("HTTP " + response.status);
          const data = Buffer.from(await response.arrayBuffer());
          const imageHeader =
            data
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
            (data.toString("ascii", 0, 4) === "RIFF" &&
              data.toString("ascii", 8, 12) === "WEBP");
          if (
            (!response.headers.get("content-type")?.startsWith("image/") &&
              !imageHeader) ||
            !data.length
          )
            throw Error("Expected image");
          const extension = path.extname(
            new URL(url, "https://www.tarkovhead.com").pathname,
          );
          const local =
            "/assets/map-icons/" +
            crypto.createHash("sha256").update(url).digest("hex").slice(0, 24) +
            extension;
          await fs.mkdir(path.join(root, "public/assets/map-icons"), {
            recursive: true,
          });
          await fs.writeFile(path.join(root, "public", local), data);
          index[url] = local;
          downloaded++;
          break;
        } catch (error) {
          if (attempt === 2) failures.push({ url, error: error.message });
        }
      }
    }
  }),
);
await fs.writeFile(indexFile, JSON.stringify(index));
console.log(
  JSON.stringify({ icons: urls.size, downloaded, failures }, null, 2),
);
if (failures.length) process.exitCode = 1;
