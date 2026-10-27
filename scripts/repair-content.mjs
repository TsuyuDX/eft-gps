import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(root, "public/data");
const read = async (name) =>
  JSON.parse(await fs.readFile(path.join(base, name), "utf8"));
const assets = await read("assets.json"),
  manifest = await read("manifest.json");
const report = await read("quest-content-report.json").catch(() => ({
  failures: [],
}));
const pending = [
  ...new Set(
    [...manifest.failures, ...report.failures]
      .map((x) => x.asset)
      .filter(Boolean),
  ),
];
const results = [];
function canonical(value) {
  try {
    let u = new URL(value, "https://www.tarkovhead.com");
    if (u.pathname === "/api/wiki/image")
      u = new URL(u.searchParams.get("url"));
    if (u.hostname === "static.wikia.nocookie.net")
      return u.origin + u.pathname.split("/revision/")[0];
    return u.href;
  } catch {
    return value;
  }
}
const known = new Map(
  Object.entries(assets).map(([remote, local]) => [canonical(remote), local]),
);
let cursor = 0;
await fs.mkdir(path.join(root, "public/assets/repaired"), { recursive: true });
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (;;) {
      const remote = pending[cursor++];
      if (!remote) return;
      if (assets[remote]) continue;
      const alias = known.get(canonical(remote));
      if (
        alias &&
        (await fs.stat(path.join(root, "public", alias)).catch(() => null))
      ) {
        assets[remote] = alias;
        results.push({
          asset: remote,
          status: "restored",
          method: "existing-original",
        });
        continue;
      }
      const full = new URL(remote, "https://www.tarkovhead.com");
      const direct =
        full.pathname === "/api/wiki/image"
          ? full.searchParams.get("url")
          : null;
      const candidates = [
        ...new Set(
          [direct, canonical(remote), full.href].filter(
            (value) =>
              value &&
              /^https:\/\/(www\.tarkovhead\.com|assets\.tarkov\.dev|static\.wikia\.nocookie\.net)\//.test(
                value,
              ),
          ),
        ),
      ];
      let error = "Источник недоступен";
      for (const url of candidates) {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(9000),
          });
          if (!response.ok) throw Error("HTTP " + response.status);
          const bytes = Buffer.from(await response.arrayBuffer());
          const header = bytes.subarray(0, 12);
          const ext =
            header[0] === 137 && header.toString("ascii", 1, 4) === "PNG"
              ? ".png"
              : header[0] === 255 && header[1] === 216
                ? ".jpg"
                : header.toString("ascii", 0, 4) === "GIF8"
                  ? ".gif"
                  : header.toString("ascii", 0, 4) === "RIFF" &&
                      header.toString("ascii", 8, 12) === "WEBP"
                    ? ".webp"
                    : null;
          if (!ext || bytes.length > 30 * 1024 * 1024)
            throw Error("Не является поддерживаемым изображением");
          const local =
            "/assets/repaired/" +
            crypto
              .createHash("sha256")
              .update(remote)
              .digest("hex")
              .slice(0, 24) +
            ext;
          await fs.writeFile(path.join(root, "public", local), bytes);
          assets[remote] = local;
          known.set(canonical(remote), local);
          results.push({ asset: remote, status: "restored", source: url });
          break;
        } catch (e) {
          error = e.message;
        }
      }
      if (!assets[remote])
        results.push({ asset: remote, status: "unavailable", error });
    }
  }),
);
for (const remote of pending) {
  const local = known.get(canonical(remote));
  if (!assets[remote] && local) assets[remote] = local;
}
manifest.failures = manifest.failures.filter(
  (x) => !x.asset || !assets[x.asset],
);
report.failures = report.failures.filter((x) => !x.asset || !assets[x.asset]);
manifest.counts.assets = Object.keys(assets).length;
await fs.writeFile(path.join(base, "assets.json"), JSON.stringify(assets));
await fs.writeFile(path.join(base, "manifest.json"), JSON.stringify(manifest));
await fs.writeFile(
  path.join(base, "quest-content-report.json"),
  JSON.stringify(report, null, 2),
);
await fs.writeFile(
  path.join(base, "content-repair-report.json"),
  JSON.stringify(
    {
      savedAt: new Date().toISOString(),
      restored: results.filter((x) => x.status === "restored").length,
      alreadyAvailable:
        pending.filter((u) => assets[u]).length -
        results.filter((x) => x.status === "restored").length,
      remaining: pending.filter((u) => !assets[u]).length,
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    restored: results.filter((x) => x.status === "restored").length,
    alreadyAvailable:
      pending.filter((u) => assets[u]).length -
      results.filter((x) => x.status === "restored").length,
    remaining: pending.filter((u) => !assets[u]).length,
  }),
);
