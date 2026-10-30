import fs from "node:fs/promises";
import crypto from "node:crypto";
const out = "public/assets/eft-gps-markers";
const P = {
  box: '<rect x="12" y="15" width="20" height="16" rx="2"/><path d="M12 20h20M18 20v11M26 20v11M17 15v-3h10v3"/>',
  bag: '<rect x="12" y="17" width="20" height="14" rx="5"/><path d="M17 17v-5h10v5M16 21v6M28 21v6"/>',
  jacket: '<path d="m17 12-6 6 4 5 2-3v12h10V20l2 3 4-5-6-6-5 4Z M22 16v16"/>',
  safe: '<rect x="12" y="11" width="20" height="22" rx="3"/><circle cx="22" cy="22" r="5"/><path d="M22 17v10M17 22h10M29 16v12"/>',
  drawer:
    '<rect x="13" y="11" width="18" height="22" rx="2"/><path d="M13 18h18M13 25h18M20 15h4M20 22h4M20 29h4"/>',
  medical:
    '<rect x="12" y="15" width="20" height="16" rx="3"/><path d="M18 15v-4h8v4M22 19v8M18 23h8"/>',
  tool: '<path d="M16 12a7 7 0 0 0 8 9l8 8-4 4-8-8a7 7 0 0 1-9-8l5 5 5-5Z"/>',
  skull:
    '<path d="M15 26c-8-13 22-20 16-1l-4 3v5H17v-5Z"/><path d="m17 21 3 1m6-1-3 1M20 29v4M24 29v4"/>',
  ammo: '<path d="M14 30V16l3-5 3 5v14Zm10 0V16l3-5 3 5v14ZM14 25h6M24 25h6"/>',
  cross: '<path d="M22 11v22M11 22h22"/><circle cx="22" cy="22" r="8"/>',
  person:
    '<circle cx="22" cy="16" r="4"/><path d="M13 32v-5c0-8 18-8 18 0v5M18 27v5M26 27v5"/>',
  helmet:
    '<path d="M12 24v-4a10 10 0 0 1 20 0v4H12ZM16 24v6l6 3 6-3v-6M22 10v8"/>',
  crown: '<path d="m11 16 6 5 5-10 5 10 6-5-3 14H14ZM14 33h16"/>',
  arrow: '<path d="M19 12H12v20h7M19 22h15M28 16l6 6-6 6"/>',
  arrows: '<path d="M10 17h23M27 11l6 6-6 6M34 28H11M17 22l-6 6 6 6"/>',
  key: '<circle cx="17" cy="17" r="6"/><path d="m21 21 12 12M27 27l4-4M30 30l4-4"/>',
  lock: '<rect x="13" y="20" width="18" height="13" rx="2"/><path d="M17 20v-6a5 5 0 0 1 10 0v6M22 25v3"/>',
  warning: '<path d="M22 12v12M22 29v1"/>',
  mortar:
    '<path d="m16 12 10 17M12 16l9-5M13 33h20M19 28l-3 5M26 27l4 6M30 12l4-3M32 18h4"/>',
  switch:
    '<rect x="12" y="11" width="20" height="22" rx="3"/><path d="m23 14-6 9h9l-5 7"/>',
  gun: '<path d="M10 19h24M15 19v6h11l4-6M22 25v8M16 33l6-8 7 8M12 16v6"/>',
  quest: '<path d="M17 12h-4v22h18V12h-4M18 10h8v5h-8ZM17 24l4 4 7-8"/>',
  document: '<path d="M14 10h12l6 6v18H14ZM25 10v7h7M18 23h10M18 28h8"/>',
  truck:
    '<path d="M10 15h17v14H10ZM27 20h5l4 5v4h-9M13 15v-3h10M31 20v5h5"/><circle cx="16" cy="30" r="3"/><circle cx="30" cy="30" r="3"/>',
  diamond:
    '<path d="m22 11 12 11-12 11-12-11ZM10 22h24M22 11l5 11-5 11-5-11Z"/>',
  bolt: '<path d="m24 10-12 15h10l-2 10 13-16H23Z"/>',
  drop: '<path d="M22 10S11 22 13 28c3 9 18 6 18-3 0-5-9-15-9-15ZM17 26c0 3 2 4 4 4"/>',
  bottle: '<path d="M18 10h8v6l4 5v12H14V21l4-5ZM18 14h8M14 24h16"/>',
  info: '<circle cx="22" cy="14" r="1"/><path d="M19 21h3v11M18 32h8"/>',
  flag: '<path d="M15 34V11l17 3-5 7-12-2"/>',
};
const specs = new Map();
const add = (name, group, glyph, shape = "square") =>
  specs.set(name, { group, glyph, shape });
const containers = new Set(["weapon-box", "other"]);
const categories = new Set();
const documents = new Set();
for (const folder of [
  "public/data/maps",
  "public/data/pve/maps",
  "public/data/en/maps",
  "public/data/en/pve/maps",
]) {
  let names;
  try {
    names = await fs.readdir(folder);
  } catch {
    continue;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    let m;
    try {
      m = JSON.parse(await fs.readFile(folder + "/" + name)).map;
    } catch {
      continue;
    }
    for (const x of m?.lootContainers || [])
      if (x.lootContainer?.normalizedName)
        containers.add(x.lootContainer.normalizedName);
    for (const c of Object.keys(m?.lootLoose || {})) categories.add(c);
    for (const d of m?.seasonalDocuments || [])
      if (d.iconType) documents.add(d.iconType);
  }
}
for (const c of containers) {
  let glyph = /jacket/.test(c)
    ? "jacket"
    : /safe|cash/.test(c)
      ? "safe"
      : /drawer/.test(c)
        ? "drawer"
        : /med/.test(c)
          ? "medical"
          : /body|dead|corpse/.test(c)
            ? "skull"
            : /tool/.test(c)
              ? "tool"
              : /ammo|grenade/.test(c)
                ? "ammo"
                : /bag|case|suitcase/.test(c)
                  ? "bag"
                  : "box";
  add("container_" + c, "container", glyph);
}
for (const [name, glyph] of Object.entries({
  pmc: "helmet",
  scav: "person",
  boss: "crown",
  sniper_scav: "cross",
  rogue: "helmet",
  "cultist-priest": "skull",
  bloodhound: "person",
  "black-div": "helmet",
  af: "helmet",
}))
  add("spawn_" + name, "spawn", glyph, "circle");
for (const type of ["pmc", "scav", "shared"])
  add("extract_" + type, "extract", "arrow", "shield");
for (const [name, group, glyph, shape] of [
  ["extract_transit", "transit", "arrows", "hex"],
  ["hazard", "hazard", "warning", "triangle"],
  ["hazard_sniper", "hazard", "cross", "triangle"],
  ["hazard_minefield", "hazard", "warning", "triangle"],
  ["hazard_mortar", "hazard", "mortar", "triangle"],
  ["key", "loot", "key", "square"],
  ["lock", "loot", "lock", "square"],
  ["switch", "loot", "switch", "square"],
  ["stationarygun", "hazard", "gun", "hex"],
  ["quest_item", "quest", "box", "hex"],
  ["quest_objective", "quest", "quest", "hex"],
  ["loose_loot", "loot", "diamond", "diamond"],
  ["seasonal_document", "document", "document", "square"],
  ["btr", "btr", "truck", "square"],
  ["custom_pin", "custom", "flag", "shield"],
])
  add(name, group, glyph, shape);
for (const type of documents)
  add(
    "document_" + type,
    "document",
    /medical/.test(type) ? "medical" : "document",
    "square",
  );
const categoryNames = {};
for (const c of categories) {
  const key =
    "loot_" + crypto.createHash("sha1").update(c).digest("hex").slice(0, 10);
  categoryNames[c] = key;
  const glyph = /мед|лекар|инъект|medic|inject/i.test(c)
    ? "medical"
    : /элект|electro/i.test(c)
      ? "bolt"
      : /горюч|топлив|fuel/i.test(c)
        ? "drop"
        : /напит|провиз|food|drink/i.test(c)
          ? "bottle"
          : /инстру|tool|строи|build/i.test(c)
            ? "tool"
            : /док|document|инфо|info/i.test(c)
              ? "document"
              : /ключ|key/i.test(c)
                ? "key"
                : /патрон|ammo|оруж|weapon/i.test(c)
                  ? "ammo"
                  : "diamond";
  add(key, "loot", glyph, "diamond");
  specs.get(key).badge = c
    .split(/[ -]+/)
    .map((word) => (word.match(/\p{L}/u) || [])[0] || "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}
function shape(kind) {
  return kind === "circle"
    ? '<circle cx="22" cy="22" r="19"/>'
    : kind === "shield"
      ? '<path d="M5 5h34v24L22 41 5 29Z"/>'
      : kind === "triangle"
        ? '<path d="m22 2 21 38H1Z"/>'
        : kind === "hex"
          ? '<path d="m12 3 20 0 11 19-11 19H12L1 22Z"/>'
          : kind === "diamond"
            ? '<path d="m22 1 21 21-21 21L1 22Z"/>'
            : '<rect x="3" y="3" width="38" height="38" rx="8"/>';
}
await fs.mkdir(out, { recursive: true });
const manifest = { format: 1, icons: {}, categories: categoryNames };
const usedColors = new Set();
for (const [name, s] of specs) {
  const hue =
    parseInt(
      crypto.createHash("sha256").update(name).digest("hex").slice(0, 6),
      16,
    ) % 360;
  let color =
    s.group === "hazard" ? `hsl(${hue % 30} 95% 70%)` : `hsl(${hue} 85% 74%)`;
  let tint = 0;
  while (usedColors.has(color)) color = `hsl(${(hue + ++tint) % 360} 85% 74%)`;
  usedColors.add(color);
  const frame = shape(s.shape);
  const badge =
    s.badge ||
    (name.startsWith("document_")
      ? name
          .slice(9)
          .split("-")
          .map((w) => w[0])
          .join("")
          .slice(0, 3)
          .toUpperCase()
      : name.startsWith("container_")
        ? name
            .slice(10)
            .split("-")
            .map((w) => w[0])
            .join("")
            .slice(0, 3)
            .toUpperCase()
        : name === "extract_scav"
          ? "S"
          : name === "extract_pmc"
            ? "P"
            : name === "extract_shared"
              ? "P/S"
              : name.startsWith("spawn_")
                ? name
                    .slice(6)
                    .replace("sniper_scav", "SN")
                    .slice(0, 2)
                    .toUpperCase()
                : "");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 50 50"><g stroke="#030507" stroke-width="6" stroke-linejoin="round" fill="#101419">' +
    frame +
    '</g><g fill="#101419" stroke="' +
    color +
    '" stroke-width="2.1" stroke-linejoin="round">' +
    frame +
    '</g><g fill="none" stroke="' +
    color +
    '" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
    (s.glyph === "arrow"
      ? '<g transform="translate(-1 0)">' + P[s.glyph] + "</g>"
      : P[s.glyph]) +
    "</g>" +
    (badge
      ? '<rect x="26" y="30" width="18" height="12" rx="3" fill="#07090b" stroke="' +
        color +
        '"/><text x="35" y="39" text-anchor="middle" fill="' +
        color +
        '" font-family="Arial,sans-serif" font-weight="700" font-size="8">' +
        badge +
        "</text>"
      : "") +
    "</svg>";
  await fs.writeFile(out + "/" + name + ".svg", svg);
  manifest.icons[name] = "/assets/eft-gps-markers/" + name + ".svg";
}
await fs.writeFile(
  "public/data/map-marker-theme.json",
  JSON.stringify(manifest),
);
await fs.writeFile(
  "public/core/map-marker-theme.js",
  "// Generated by scripts/generate-map-markers.mjs.\nexport const markerTheme = " +
    JSON.stringify(manifest) +
    ";\n",
);
console.log("Generated " + specs.size + " offline SVG markers");
