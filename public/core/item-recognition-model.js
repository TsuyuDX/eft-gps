// Strict OCR matching: exact complete names only, ambiguous screens stay silent.
export const normalizeItemText = (x) =>
  String(x || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function itemNameIndex(items) {
  const index = new Map();
  for (const item of items)
    for (const alias of [item.name, item.shortName]) {
      const key = normalizeItemText(alias);
      if (key.length < 5) continue;
      const values = index.get(key) || new Map();
      values.set(item.normalizedName, item);
      index.set(key, values);
    }
  return index;
}
export function matchItemLines(lines, index) {
  const found = new Map();
  for (let n = 0; n < lines.length; n++)
    for (let count = 1; count <= 2; count++) {
      const key = normalizeItemText(
        lines.slice(n, n + count).join(" "),
      ).replace(/^(?:f |take |взять |осмотреть )+/, "");
      for (const [slug, item] of index.get(key) || []) found.set(slug, item);
    }
  return found.size === 1 ? [...found.values()][0] : null;
}
export function recognitionConfig(x = {}) {
  return {
    enabled: x.enabled === true,
    interval:
      Number.isInteger(x.interval) && x.interval >= 5 && x.interval <= 60
        ? x.interval
        : 10,
    duration:
      Number.isInteger(x.duration) && x.duration >= 3 && x.duration <= 30
        ? x.duration
        : 8,
    prices: x.prices !== false,
    quests: x.quests !== false,
    playerLevel:
      Number.isInteger(x.playerLevel) &&
      x.playerLevel >= 0 &&
      x.playerLevel <= 79
        ? x.playerLevel
        : 0,
    traders: Array.isArray(x.traders)
      ? [
          ...new Set(
            x.traders.filter((v) =>
              [
                "prapor",
                "therapist",
                "skier",
                "peacekeeper",
                "mechanic",
                "ragman",
                "jaeger",
                "fence",
                "ref",
              ].includes(v),
            ),
          ),
        ]
      : [],
  };
}
export function validRecognitionConfig(x) {
  if (!x || typeof x !== "object" || Object.keys(x).length !== 7) return false;
  const normalized = recognitionConfig(x);
  return Object.keys(normalized).every((k) =>
    Array.isArray(normalized[k])
      ? JSON.stringify(normalized[k]) === JSON.stringify(x[k])
      : normalized[k] === x[k],
  );
}
export function traderQuotes(item, config) {
  const all = (item?.sellFor || [])
    .filter(
      (v) =>
        Number.isFinite(v.priceRUB) &&
        v.priceRUB > 0 &&
        typeof v.vendor?.normalizedName === "string" &&
        v.vendor.normalizedName !== "flea-market",
    )
    .sort((a, b) => b.priceRUB - a.priceRUB);
  const market = (item?.sellFor || []).find(
    (v) => v.vendor?.normalizedName === "flea-market",
  );
  const minimum = market?.requirements?.find(
    (r) => r.type === "playerLevel",
  )?.value;
  const fleaLevel =
    Number.isInteger(minimum) && minimum >= 0 && minimum <= 79 ? minimum : null;
  return {
    fleaLevel,
    fleaAvailable: fleaLevel !== null && config.playerLevel >= fleaLevel,
    best: all[0] || null,
    available:
      all.find((v) => config.traders.includes(v.vendor.normalizedName)) || null,
    flea: item?.types?.includes("noFlea")
      ? null
      : Number.isFinite(item?.lastLowPrice) && item.lastLowPrice > 0
        ? item.lastLowPrice
        : null,
  };
}
