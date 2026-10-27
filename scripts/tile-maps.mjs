import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  base = path.join(root, "public/data"),
  assets = path.join(root, "public/assets"),
  cache = path.join(base, "tiles-cache");
fs.mkdirSync(cache, { recursive: true });
const errors = [];
async function pool(jobs, fn, n = 6) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (;;) {
        const j = jobs[i++];
        if (!j) return;
        await fn(j);
      }
    }),
  );
}
for (const file of fs.readdirSync(path.join(base, "maps"))) {
  const m = JSON.parse(fs.readFileSync(path.join(base, "maps", file))).map;
  const z = 3,
    scale = 2 ** z,
    size = m.tileSize || 256,
    a = m.transform || [1, 0, 1, 0],
    rad = ((m.coordinateRotation || 0) * Math.PI) / 180;
  const point = (x, y) => ({
    x: scale * (a[0] * (x * Math.cos(rad) - y * Math.sin(rad)) + a[1]),
    y: scale * (-a[2] * (x * Math.sin(rad) + y * Math.cos(rad)) + a[3]),
  });
  const b = m.bounds,
    corners = [
      point(b[0][0], b[0][1]),
      point(b[0][0], b[1][1]),
      point(b[1][0], b[0][1]),
      point(b[1][0], b[1][1]),
    ];
  const minX = Math.min(...corners.map((x) => x.x)),
    minY = Math.min(...corners.map((x) => x.y)),
    width = Math.max(...corners.map((x) => x.x)) - minX,
    height = Math.max(...corners.map((x) => x.y)) - minY;
  for (const layer of [m, ...(m.layers || [])]) {
    if (!layer.tilePath || layer.svgPath) continue;
    const key = layer.tilePath
        .split("/maps/")[1]
        .split("/{z}")[0]
        .replaceAll("/", "-"),
      name = "tiles-" + key + ".svg",
      target = path.join(assets, name);
    layer.renderedPath = "/assets/" + name;
    if (fs.existsSync(target)) continue;
    const tiles = [];
    for (
      let x = Math.max(0, Math.floor(minX / size));
      x <= Math.floor((minX + width) / size);
      x++
    )
      for (
        let y = Math.max(0, Math.floor(minY / size));
        y <= Math.floor((minY + height) / size);
        y++
      )
        tiles.push({ x, y });
    let parts = [];
    await pool(tiles, async ({ x, y }) => {
      const url = layer.tilePath
          .replace("{z}", z)
          .replace("{x}", x)
          .replace("{y}", y),
        f = path.join(cache, key + "-" + z + "-" + x + "-" + y + ".png");
      try {
        let bytes;
        if (fs.existsSync(f)) bytes = fs.readFileSync(f);
        else {
          const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (r.status === 404) return;
          if (!r.ok) throw Error(r.status);
          bytes = Buffer.from(await r.arrayBuffer());
          fs.writeFileSync(f, bytes);
        }
        parts.push(
          `<image x="${x * size}" y="${y * size}" width="${size}" height="${size}" href="data:image/png;base64,${bytes.toString("base64")}"/>`,
        );
      } catch (e) {
        errors.push({ url, error: e.message });
      }
    });
    fs.writeFileSync(
      target,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${Math.ceil(width)}" height="${Math.ceil(height)}"><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#101415"/>${parts.join("")}</svg>`,
    );
    console.log(m.name, layer.name || "main", parts.length, "tiles");
  }
  fs.writeFileSync(path.join(base, "maps", file), JSON.stringify({ map: m }));
  const pve = path.join(base, "pve/maps", file);
  if (fs.existsSync(pve)) {
    const p = JSON.parse(fs.readFileSync(pve));
    p.map.renderedPath = m.renderedPath;
    for (let i = 0; i < (m.layers || []).length; i++)
      if (p.map.layers?.[i])
        p.map.layers[i].renderedPath = m.layers[i].renderedPath;
    fs.writeFileSync(pve, JSON.stringify(p));
  }
}
fs.writeFileSync(path.join(base, "tiles-report.json"), JSON.stringify(errors));
console.log("TILES DONE", errors.length, "errors");
