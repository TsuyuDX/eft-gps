import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
export function acquireUpdateLock(root) {
  const file = path.join(root, "update.lock");
  if (fs.existsSync(file)) {
    let active = true;
    try {
      const pid = JSON.parse(fs.readFileSync(file)).pid;
      if (!Number.isInteger(pid) || pid < 1) active = false;
      else
        try {
          process.kill(pid, 0);
        } catch (e) {
          if (e.code === "ESRCH") active = false;
        }
    } catch {
      active = false;
    }
    if (active) throw Error("Обновление уже запущено. Дождитесь завершения.");
    fs.mkdirSync(path.join(root, "work"), { recursive: true });
    fs.renameSync(
      file,
      path.join(root, "work", "stale-lock-" + randomUUID() + ".json"),
    );
  }
  const token = randomUUID();
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, token }), {
    flag: "wx",
  });
  return () => {
    try {
      if (JSON.parse(fs.readFileSync(file)).token === token)
        fs.unlinkSync(file);
    } catch {}
  };
}
export function validateSnapshot(appRoot, stagedRoot) {
  const read = (relative) =>
    JSON.parse(fs.readFileSync(path.join(stagedRoot, "public/data", relative)));
  const manifest = read("manifest.json");
  const previous = JSON.parse(
    fs.readFileSync(path.join(appRoot, "public/data/manifest.json")),
  );
  if (!manifest.savedAt || !Number.isFinite(Date.parse(manifest.savedAt)))
    throw Error("В снимке нет корректной даты");
  for (const mode of ["regular", "pve"]) {
    for (const type of ["items", "quests"]) {
      const rows = read(`${mode}/${type}.json`);
      const min =
        type === "items"
          ? Math.max(1000, (previous.counts?.items || 0) * 0.85)
          : 100;
      if (!Array.isArray(rows) || rows.length < min)
        throw Error(`Неполный каталог: ${mode}/${type}`);
      const seen = new Set();
      for (const row of rows) {
        if (
          !row.normalizedName ||
          seen.has(row.normalizedName) ||
          /[\\/]/.test(row.normalizedName)
        )
          throw Error("Некорректная запись каталога");
        seen.add(row.normalizedName);
        const card = read(
          `${mode === "pve" ? "pve/" : ""}${type}/${row.normalizedName}.json`,
        )[type === "items" ? "item" : "quest"];
        if (card?.normalizedName !== row.normalizedName || !card.name)
          throw Error("Неполная карточка: " + row.normalizedName);
      }
    }
  }
  const maps = read("maps.json");
  if (!Array.isArray(maps) || maps.length < 10)
    throw Error("Неполный список карт");
  for (const map of maps)
    for (const prefix of ["", "pve/"]) {
      const card = read(prefix + "maps/" + map.normalizedName + ".json").map;
      if (!card?.name) throw Error("Не загружена карта: " + map.normalizedName);
    }
  for (const local of Object.values(read("assets.json"))) {
    const full = path.resolve(stagedRoot, "public", "." + local);
    if (
      !full.startsWith(path.resolve(stagedRoot, "public/assets") + path.sep) ||
      !fs.statSync(full).isFile()
    )
      throw Error("Не загружено изображение");
  }
  if (
    manifest.failures?.some(
      (x) => x.url && /\/api\/(item|quest|map)\//.test(x.url),
    )
  )
    throw Error("Не все основные данные были загружены");
  return manifest;
}
export function commitSnapshot(
  root,
  stagedRoot,
  { rename = fs.renameSync } = {},
) {
  const backup = path.join(
    root,
    "snapshot-backup-" + Date.now() + "-" + randomUUID().slice(0, 8),
  );
  fs.mkdirSync(backup);
  const operations = [];
  try {
    for (const name of ["data", "assets"]) {
      const live = path.join(root, "public", name),
        old = path.join(backup, name),
        staged = path.join(stagedRoot, "public", name);
      rename(live, old);
      operations.push([old, live]);
      rename(staged, live);
      operations.push([live, staged]);
    }
    const reference = path.join(stagedRoot, "public/reference.css");
    if (fs.existsSync(reference)) {
      const live = path.join(root, "public/reference.css");
      if (fs.existsSync(live)) {
        rename(live, path.join(backup, "reference.css"));
        operations.push([path.join(backup, "reference.css"), live]);
      }
      rename(reference, live);
      operations.push([live, reference]);
    }
    return backup;
  } catch (error) {
    const rollbackErrors = [];
    for (const [from, to] of operations.reverse()) {
      try {
        fs.renameSync(from, to);
      } catch (e) {
        rollbackErrors.push(e.message);
      }
    }
    if (rollbackErrors.length)
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Не удалось полностью восстановить снимок. Резервная копия: " + backup,
      );
    throw error;
  }
}
