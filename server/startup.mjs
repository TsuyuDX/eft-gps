import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
async function directory(value) {
  if (!value) return false;
  try {
    return (await fs.stat(value)).isDirectory();
  } catch {
    return false;
  }
}
export async function discoverGamePaths(
  config = {},
  { home = os.homedir(), env = process.env } = {},
) {
  const documents = [env.TARKOV_DOCUMENTS_PATH,
    path.join(home, "Documents"),
    env.OneDrive && path.join(env.OneDrive, "Documents"),
    env.OneDriveConsumer && path.join(env.OneDriveConsumer, "Documents"),
  ].filter(Boolean);
  const screenshotCandidates = [
    config.screenshotsPath,
    ...documents.flatMap((p) =>
      ["Escape from Tarkov", "Escape From Tarkov"].map((n) =>
        path.join(p, n, "Screenshots"),
      ),
    ),
  ];
  const libraries = new Set(
    [
      env["ProgramFiles(x86)"] && path.join(env["ProgramFiles(x86)"], "Steam"),
      env.ProgramFiles && path.join(env.ProgramFiles, "Steam"),
    ].filter(Boolean),
  );
  for (const steam of [...libraries]) {
    try {
      const vdf = await fs.readFile(
        path.join(steam, "steamapps", "libraryfolders.vdf"),
        "utf8",
      );
      for (const match of vdf.matchAll(/"path"\s+"([^"\n]+)"/g)) {
        const candidate = match[1].replaceAll("\\\\", "\\");
        if (path.isAbsolute(candidate)) libraries.add(candidate);
      }
    } catch {}
  }
  const roots = [...libraries].map((p) =>
    path.join(p, "steamapps", "common", "Escape from Tarkov"),
  );
  if (env["ProgramFiles(x86)"])
    roots.push(path.join(env["ProgramFiles(x86)"], "Escape from Tarkov"));
  if (env.ProgramFiles)
    roots.push(path.join(env.ProgramFiles, "Escape from Tarkov"));
  const logCandidates = [
    config.logsPath,
    ...roots.flatMap((p) => [
      path.join(p, "build", "Logs"),
      path.join(p, "Logs"),
    ]),
  ];
  async function find(candidates) {
    for (const candidate of [...new Set(candidates.filter(v=>typeof v==="string" && v.length>0))].slice(
      0,
      40,
    ))
      if (await directory(candidate)) return candidate;
    return "";
  }
  const [screenshotsPath, logsPath] = await Promise.all([
    find(screenshotCandidates),
    find(logCandidates),
  ]);
  return { screenshotsPath, logsPath };
}
export async function startupDiagnostics(root, config, options) {
  const checks = [];
  async function fileCheck(id, label, relative, critical = true) {
    try {
      const stat = await fs.stat(path.join(root, relative));
      if (!stat.isFile() || !stat.size) throw Error();
      checks.push({ id, label, state: "ok", critical });
    } catch {
      checks.push({
        id,
        label,
        state: critical ? "error" : "warning",
        critical,
      });
    }
  }
  await fileCheck("database", "Локальная база", "public/data/manifest.json");
  try {
    const [maps, items] = await Promise.all(
      ["maps.json", "regular/items.json"].map((p) =>
        fs.readFile(path.join(root, "public/data", p), "utf8").then(JSON.parse),
      ),
    );
    if (!maps.length || !items.length) throw Error();
    checks.push({
      id: "catalog",
      label: "Карты и справочник",
      state: "ok",
      critical: true,
    });
  } catch {
    checks.push({
      id: "catalog",
      label: "Карты и справочник",
      state: "error",
      critical: true,
    });
  }
  // Correct the common result shape for the catalog check.
  for (const check of checks)
    if (!check.label) check.label = "Карты и справочник";
  await fileCheck("gps", "Модуль GPS", "runtime/GpsCapture.exe", false);
  let probeCreated = false;
  const probe = path.join(
    root,
    "userdata",
    ".startup-probe-" + crypto.randomUUID() + ".tmp",
  );
  try {
    await fs.mkdir(path.dirname(probe), { recursive: true });
    const handle = await fs.open(probe, "wx");
    probeCreated = true;
    try {
      await handle.writeFile("ok");
    } finally {
      await handle.close();
    }
    checks.push({
      id: "saves",
      label: "Сохранение прогресса",
      state: "ok",
      critical: true,
    });
  } catch {
    checks.push({
      id: "saves",
      label: "Сохранение прогресса",
      state: "error",
      critical: true,
    });
  } finally {
    if (probeCreated)
      try {
        await fs.unlink(probe);
      } catch {}
  }
  const discovered = await discoverGamePaths(config, options);
  checks.push({
    id: "screenshots",
    label: "Папка скриншотов",
    state: discovered.screenshotsPath ? "ok" : "warning",
    critical: false,
    path: discovered.screenshotsPath,
  });
  checks.push({
    id: "logs",
    label: "Логи игры",
    state: discovered.logsPath ? "ok" : "warning",
    critical: false,
    path: discovered.logsPath,
  });
  return {
    checks,
    discovered,
    ready: checks.every((c) => !c.critical || c.state === "ok"),
  };
}
