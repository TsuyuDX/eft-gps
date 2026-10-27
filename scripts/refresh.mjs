import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Keep the previous snapshot intact until a complete replacement is prepared.
const work = path.join(root, "update-staging"),
  data = path.join(root, "public/data"),
  assets = path.join(root, "public/assets");
if (fs.existsSync(work))
  throw Error(
    "update-staging already exists. Inspect the previous update before starting another one.",
  );
fs.mkdirSync(path.join(work, "public/data"), { recursive: true });
fs.mkdirSync(path.join(work, "public/assets"), { recursive: true });
fs.mkdirSync(path.join(work, "scripts"), { recursive: true });
for (const file of [
  "snapshot.mjs",
  "modes.mjs",
  "extra-articles.mjs",
  "prepare-articles.mjs",
  "guide-assets.mjs",
  "tile-maps.mjs",
  "finalize.mjs",
  "repair-assets.mjs",
])
  fs.copyFileSync(
    path.join(root, "scripts", file),
    path.join(work, "scripts", file),
  );
fs.copyFileSync(
  path.join(root, "public/style.css"),
  path.join(work, "public/style.css"),
);
for (const file of [
  "snapshot.mjs",
  "modes.mjs",
  "extra-articles.mjs",
  "prepare-articles.mjs",
  "guide-assets.mjs",
  "tile-maps.mjs",
  "finalize.mjs",
  "repair-assets.mjs",
]) {
  const r = spawnSync(process.execPath, [path.join(work, "scripts", file)], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0)
    throw Error(
      "Update failed; the current snapshot has been preserved. See update-staging.",
    );
}
const m = JSON.parse(
  fs.readFileSync(path.join(work, "public/data/manifest.json")),
);
if (
  m.failures.some(
    (x) =>
      x.url &&
      /^https:\/\/www\.tarkovhead\.com\/(api\/(item|quest|map)\/|ru\/items-tracker)/.test(
        x.url,
      ),
  )
)
  throw Error(
    "Some downloads failed; the current snapshot has been preserved. Inspect update-staging.",
  );
const backup = path.join(root, "snapshot-backup-" + Date.now());
fs.mkdirSync(backup);
fs.renameSync(data, path.join(backup, "data"));
fs.renameSync(assets, path.join(backup, "assets"));
fs.renameSync(path.join(work, "public/data"), data);
fs.renameSync(path.join(work, "public/assets"), assets);
fs.copyFileSync(
  path.join(work, "public/reference.css"),
  path.join(root, "public/reference.css"),
);
fs.copyFileSync(
  path.join(work, "public/style.css"),
  path.join(root, "public/style.css"),
);
console.log("Snapshot updated. Previous snapshot:", backup);
