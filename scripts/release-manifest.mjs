import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
const top = ["public", "server", "scripts", "runtime", "test", "node_modules"];
async function walk(relative) {
  const stat = await fs.lstat(path.join(root, relative));
  if (stat.isSymbolicLink())
    throw Error("Ссылка в составе выпуска: " + relative);
  if (stat.isDirectory()) {
    for (const name of await fs.readdir(path.join(root, relative))) {
      if (
        relative === "node_modules" &&
        ["prettier", ".bin", ".package-lock.json"].includes(name)
      )
        continue;
      await walk(relative + "/" + name);
    }
  } else files.push({ path: relative, size: stat.size });
}
for (const name of top) await walk(name);
for (const name of [
  "Tarkov Offline.exe",
  "Tarkov GPS.exe",
  "EFT GPS.exe",
  "README.en.md",
  "package.json",
  "package-lock.json",
  "server.mjs",
  "README.md",
  "Запустить.cmd",
  "Обновить базу.cmd",
  "TarkovOffline.code-workspace",
])
  await walk(name);
let cursor = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (;;) {
      const file = files[cursor++];
      if (!file) return;
      const hash = crypto.createHash("sha256");
      for await (const chunk of createReadStream(path.join(root, file.path)))
        hash.update(chunk);
      file.sha256 = hash.digest("hex");
    }
  }),
);
files.sort((a, b) => a.path.localeCompare(b.path, "en"));
const manifest = {
  format: 1,
  app: "TarkovOffline",
  version: JSON.parse(await fs.readFile(path.join(root, "package.json")))
    .version,
  builtAt: new Date().toISOString(),
  files,
};
await fs.mkdir(path.join(root, "work"), { recursive: true });
await fs.writeFile(
  path.join(root, "work/release-input.json"),
  JSON.stringify(manifest),
);
console.log(
  JSON.stringify({
    version: manifest.version,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.size, 0),
  }),
);
