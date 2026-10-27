// Pure format and geometry helpers shared by the local service and UI.
const number = "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?";
const triple = `(${number})\\s*,\\s*(${number})\\s*,\\s*(${number})`;
const pattern = new RegExp(
  `^\\d{4}-\\d{2}-\\d{2}\\[\\d{2}-\\d{2}(?:-\\d{2})?\\]_?${triple}_?${triple}\\s*,\\s*(${number})(?:_|\\s|\\(|\\.)`,
  "i",
);
export function parseScreenshot(filename) {
  const name = filename.split(/[\\/]/).at(-1);
  if (!/\.(png|jpe?g)$/i.test(name)) return null;
  const match = name.match(pattern);
  if (!match) return null;
  const [x, y, z, qx, qy, qz, qw] = match.slice(1, 8).map(Number);
  if (
    ![x, y, z, qx, qy, qz, qw].every(Number.isFinite) ||
    Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > 100000
  )
    return null;
  const length = Math.hypot(qx, qy, qz, qw);
  if (length < 0.1 || length > 2) return null;
  const [a, b, c, d] = [qx, qy, qz, qw].map((v) => v / length);
  const rotation =
    ((Math.atan2(2 * (d * b + a * c), 1 - 2 * (b * b + c * c)) * 180) /
      Math.PI +
      360) %
    360;
  return { position: { x, y, z }, rotation };
}
const names = {
  bigmap: "customs",
  customs: "customs",
  woods: "woods",
  interchange: "interchange",
  shoreline: "shoreline",
  rezervbase: "reserve",
  reserve: "reserve",
  lighthouse: "lighthouse",
  tarkovstreets: "streets-of-tarkov",
  streets: "streets-of-tarkov",
  city_preset: "streets-of-tarkov",
  factory4_day: "factory",
  factory4_night: "night-factory",
  factory_day_preset: "factory",
  factory_night_preset: "night-factory",
  factory_day: "factory",
  factory_night: "night-factory",
  laboratory: "the-lab",
  lab: "the-lab",
  laboratory_preset: "the-lab",
  labyrinth: "the-labyrinth",
  labyrinth_preset: "the-labyrinth",
  sandbox: "ground-zero",
  sandbox_high: "ground-zero-21",
  sandbox_preset: "ground-zero",
  sandbox_high_preset: "ground-zero-21",
  terminal: "terminal",
  terminal_preset: "terminal",
  icebreaker: "icebreaker",
  icebreaker_preset: "icebreaker",
  borеy: "icebreaker",
  borey: "icebreaker",
};
export function mapName(raw) {
  const value = String(raw || "").toLowerCase();
  return names[value] || names[value.replace(/_preset$/, "")] || null;
}
export function parseLogLine(line) {
  const scene = line.match(/scene preset path:\s*maps\/([\w-]+)\.bundle/i);
  const location =
    line.match(/Location:\s*([\w-]+)/i) ||
    line.match(/"location"\s*:\s*"([\w-]+)"/i);
  const map = mapName(scene?.[1] || location?.[1]);
  const mode = line.match(/Session mode:\s*(regular|pve)/i)?.[1]?.toLowerCase();
  let raid = null;
  if (/application\|GameStarted\b/i.test(line)) raid = "active";
  else if (
    /UserMatchOver|Network game matching (?:aborted|cancelled)/i.test(line)
  )
    raid = "ended";
  else if (scene || /application\|GameStarting\b/i.test(line)) raid = "loading";
  return map || mode || raid ? { map, mode: mode || null, raid } : null;
}
export function floorFor(position, map) {
  const hits = [];
  for (const [index, layer] of (map.layers || []).entries())
    for (const extent of layer.extents || []) {
      const [low, high] = extent.height || [-Infinity, Infinity];
      if (position.y < low || position.y > high) continue;
      if (extent.bounds?.length) {
        const inside = extent.bounds.some((b) => {
          const points = b.filter((v) => Array.isArray(v));
          if (points.length < 2) return false;
          const xs = points.map((p) => p[0]),
            zs = points.map((p) => p[1]);
          return (
            position.x >= Math.min(...xs) &&
            position.x <= Math.max(...xs) &&
            position.z >= Math.min(...zs) &&
            position.z <= Math.max(...zs)
          );
        });
        if (!inside) continue;
      }
      hits.push({ index, range: high - low });
    }
  return hits.sort((a, b) => a.range - b.range)[0]?.index ?? "";
}
