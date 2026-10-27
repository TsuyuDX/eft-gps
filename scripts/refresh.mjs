import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  validateSnapshot,
  commitSnapshot,
  acquireUpdateLock,
} from "./update-transaction.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseLock = acquireUpdateLock(root);
process.on("exit", releaseLock);
// Keep the previous snapshot intact until a complete replacement is prepared.
const work = path.join(root, "update-staging"),
  data = path.join(root, "public/data"),
  assets = path.join(root, "public/assets");
if (fs.existsSync(work)) {
  fs.mkdirSync(path.join(root, "work"), { recursive: true });
  fs.renameSync(
    work,
    path.join(root, "work", "unfinished-update-" + Date.now()),
  );
}
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
  "map-icons.mjs",
  "quest-content.mjs",
  "map-detail.mjs",
  "finalize.mjs",
  "repair-assets.mjs",
  "repair-content.mjs",
])
  fs.copyFileSync(
    path.join(root, "scripts", file),
    path.join(work, "scripts", file),
  );
fs.mkdirSync(path.join(work, "public/core"), { recursive: true });
fs.copyFileSync(
  path.join(root, "public/core/map-icons.js"),
  path.join(work, "public/core/map-icons.js"),
);
fs.copyFileSync(
  path.join(root, "public/core/data.js"),
  path.join(work, "public/core/data.js"),
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
  "map-icons.mjs",
  "quest-content.mjs",
  "map-detail.mjs",
  "finalize.mjs",
  "repair-assets.mjs",
  "repair-content.mjs",
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
// English is a versioned offline snapshot shipped with the app. Preserve it
// across Russian data refreshes; its own savedAt remains unchanged.
if (fs.existsSync(path.join(data, "en"))) {
  fs.cpSync(path.join(data, "en"), path.join(work, "public/data/en"), {
    recursive: true,
  });
  const englishAssets = JSON.parse(
    fs.readFileSync(path.join(data, "en/assets.json"), "utf8"),
  );
  for (const local of new Set(Object.values(englishAssets))) {
    if (typeof local !== "string" || !local.startsWith("/assets/"))
      throw Error("Invalid English asset path");
    const source = path.resolve(root, "public", "." + local);
    if (!source.startsWith(assets + path.sep))
      throw Error("Invalid English asset path");
    const target = path.join(work, "public", local);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }
}
console.log("Проверка полноты загруженной базы…");
validateSnapshot(root, work);
const backup = commitSnapshot(root, work);
fs.mkdirSync(path.join(root, "work"), { recursive: true });
fs.renameSync(work, path.join(root, "work", "completed-update-" + Date.now()));
console.log("База обновлена. Предыдущий снимок сохранён:", backup);
