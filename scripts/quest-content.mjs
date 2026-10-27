import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://www.tarkovhead.com",
  base = path.join(root, "public/data");
const failures = [],
  urls = new Set(),
  staged = path.join(root, "work/quest-content-staging");
await fs.mkdir(staged, { recursive: true });
async function get(url, json = true) {
  let error;
  for (let i = 0; i < 3; i++)
    try {
      const r = await fetch(new URL(url, origin), {
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw Error("HTTP " + r.status);
      return json ? await r.json() : r;
    } catch (e) {
      error = e;
    }
  throw error;
}
async function pool(values, fn, n = 8) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (;;) {
        const index = cursor++,
          value = values[index];
        if (value === undefined) return;
        await fn(value, index);
      }
    }),
  );
}
function collect(value, key = "") {
  if (typeof value === "string") {
    if (
      /^(https:\/\/assets\.tarkov\.dev\/|\/api\/(media\/file\/|wiki\/image\?))/.test(
        value,
      )
    )
      urls.add(value);
  } else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) collect(v, k);
}
function text(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value && typeof value === "object")
    return [
      value.text,
      value.content,
      value.children,
      value.root,
      value.items,
      value.rows,
      value.cells,
      value.fields?.caption,
      value.fields?.slider?.map((x) => x.caption),
    ]
      .map(text)
      .join(" ");
  return "";
}
const lists = {},
  records = {};
for (const mode of ["regular", "pve"]) {
  const result = await get(`/api/quest/list?gameMode=${mode}&locale=ru`);
  if (!Array.isArray(result.quests) || result.quests.length < 100)
    throw Error("Incomplete quest list " + mode);
  lists[mode] = result.quests;
  records[mode] = {};
  await pool(result.quests, async (row, index) => {
    try {
      const cached = process.argv.includes("--reuse-cards")
        ? await fs
            .readFile(
              path.join(staged, mode, row.normalizedName + ".json"),
              "utf8",
            )
            .catch(() => null)
        : null;
      const data = cached
        ? JSON.parse(cached)
        : await get(
            `/api/quest/${encodeURIComponent(row.normalizedName)}?gameMode=${mode}&locale=ru`,
          );
      if (!data.quest?.normalizedName) throw Error("Missing quest");
      records[mode][row.normalizedName] = data;
      collect(data.quest);
      collect(row);
      await fs.mkdir(path.join(staged, mode), { recursive: true });
      await fs.writeFile(
        path.join(staged, mode, row.normalizedName + ".json"),
        JSON.stringify(data),
      );
    } catch (error) {
      failures.push({ quest: row.normalizedName, mode, error: error.message });
    }
    if (index % 150 === 0)
      console.log("Quest cards", mode, index, "/", result.quests.length);
  });
}
if (failures.length) {
  await fs.writeFile(
    path.join(staged, "failures.json"),
    JSON.stringify(failures),
  );
  throw Error("Quest cards incomplete; existing snapshot preserved");
}
const assets = JSON.parse(
  await fs.readFile(path.join(base, "assets.json"), "utf8"),
);
await fs.mkdir(path.join(root, "public/assets/quest-content"), {
  recursive: true,
});
let downloaded = 0;
await pool([...urls], async (url, index) => {
  if (
    assets[url] &&
    (await fs.stat(path.join(root, "public", assets[url])).catch(() => null))
  )
    return;
  try {
    let response;
    try {
      response = await get(url, false);
    } catch (error) {
      if (!url.startsWith("/api/wiki/image?")) throw error;
      const direct = new URL(url, origin).searchParams.get("url");
      if (!direct || !/^https:\/\/static\.wikia\.nocookie\.net\//.test(direct))
        throw error;
      response = await get(direct, false);
    }
    const bytes = Buffer.from(await response.arrayBuffer()),
      type = response.headers.get("content-type") || "";
    const magic =
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      (bytes[0] === 255 && bytes[1] === 216) ||
      bytes.toString("ascii", 0, 4) === "RIFF";
    if (!type.startsWith("image/") && !magic) throw Error("Expected image");
    const extension =
      bytes[0] === 137
        ? ".png"
        : bytes[0] === 255 && bytes[1] === 216
          ? ".jpg"
          : type.includes("svg")
            ? ".svg"
            : ".webp";
    const local =
      "/assets/quest-content/" +
      crypto.createHash("sha256").update(url).digest("hex").slice(0, 24) +
      extension;
    await fs.writeFile(path.join(root, "public", local), bytes);
    assets[url] = local;
    downloaded++;
  } catch (error) {
    failures.push({ asset: url, error: error.message });
  }
  if (index % 300 === 0) console.log("Quest images", index, "/", urls.size);
});
const summary = {};
for (const mode of ["regular", "pve"]) {
  const directory = path.join(base, mode === "pve" ? "pve/quests" : "quests");
  await fs.mkdir(directory, { recursive: true });
  const index = {};
  let guides = 0;
  for (const row of lists[mode]) {
    const data = records[mode][row.normalizedName],
      q = data.quest;
    await fs.writeFile(
      path.join(directory, row.normalizedName + ".json"),
      JSON.stringify(data),
    );
    const maps = new Map();
    for (const objective of q.objectives || [])
      for (const map of [
        ...(objective.maps || []),
        ...(objective.possibleLocations || []).map((l) => l.map),
      ])
        if (map?.normalizedName)
          maps.set(map.normalizedName, {
            name: map.name,
            normalizedName: map.normalizedName,
          });
    const searchable = [
      q.name,
      q.trader?.name,
      ...(q.objectives || []).map((o) => o.description),
      text(q.guide),
      text(q.guideCms),
      text(q.description),
      text(q.dialogue),
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const hasGuide = !!q.guide?.length || !!q.guideCms?.root?.children?.length;
    index[q.normalizedName] = {
      name: q.name,
      trader: q.trader?.name || "Сюжетное",
      traderSlug: q.trader?.normalizedName || "",
      icon:
        row.iconLink || q.iconLink || q.trader?.imageLink || q.taskImageLink,
      maps: [...maps.values()],
      text: searchable,
      hasGuide,
    };
    if (hasGuide) guides++;
  }
  await fs.writeFile(
    path.join(base, mode, "quests.json"),
    JSON.stringify(lists[mode]),
  );
  await fs.writeFile(
    path.join(base, mode, "quest-search.json"),
    JSON.stringify(index),
  );
  summary[mode] = {
    quests: lists[mode].length,
    guides,
    withoutGuide: lists[mode].length - guides,
  };
}
await fs.writeFile(path.join(base, "assets.json"), JSON.stringify(assets));
const report = {
  savedAt: new Date().toISOString(),
  summary,
  images: urls.size,
  downloaded,
  failures,
};
await fs.writeFile(
  path.join(base, "quest-content-report.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
