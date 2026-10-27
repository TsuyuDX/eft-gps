import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = {},
  jobs = [],
  failures = [];
for (const file of await fs.readdir(path.join(root, "public/data/maps"))) {
  const { map } = JSON.parse(
    await fs.readFile(path.join(root, "public/data/maps", file), "utf8"),
  );
  const z = map.maxZoom || 5,
    size = map.tileSize || 256,
    scale = 2 ** z;
  const a = map.transform || [1, 0, 1, 0],
    r = ((map.coordinateRotation || 0) * Math.PI) / 180;
  const point = (x, y) => [
    scale * (a[0] * (x * Math.cos(r) - y * Math.sin(r)) + a[1]),
    scale * (-a[2] * (x * Math.sin(r) + y * Math.cos(r)) + a[3]),
  ];
  const rectangle = (b) => {
    const p = [
      point(b[0][0], b[0][1]),
      point(b[0][0], b[1][1]),
      point(b[1][0], b[0][1]),
      point(b[1][0], b[1][1]),
    ];
    return [
      Math.min(...p.map((v) => v[0])),
      Math.min(...p.map((v) => v[1])),
      Math.max(...p.map((v) => v[0])),
      Math.max(...p.map((v) => v[1])),
    ];
  };
  const [minX, minY, maxX, maxY] = rectangle(map.svgBounds || map.bounds);
  for (const layer of [map, ...(map.layers || [])]) {
    if (layer.svgPath || !layer.tilePath || sources[layer.tilePath]) continue;
    const key = crypto
      .createHash("sha256")
      .update(layer.tilePath)
      .digest("hex")
      .slice(0, 16);
    const dir = path.join(root, "public/assets/map-detail", key);
    await fs.mkdir(dir, { recursive: true });
    const existing = new Set(await fs.readdir(dir));
    const source = (sources[layer.tilePath] = {
      z,
      size,
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
      tiles: {},
    });
    // Upper floors occupy only their documented building extents. Include a tile margin.
    const regions = (layer.extents || []).flatMap((e) =>
      (e.bounds || [])
        .filter((b) => Array.isArray(b[0]) && Array.isArray(b[1]))
        .map(rectangle),
    );
    for (
      let x = Math.max(0, Math.floor(minX / size));
      x <= Math.floor(maxX / size);
      x++
    )
      for (
        let y = Math.max(0, Math.floor(minY / size));
        y <= Math.floor(maxY / size);
        y++
      ) {
        if (
          regions.length &&
          !regions.some(
            (b) =>
              x * size <= b[2] + size &&
              (x + 1) * size >= b[0] - size &&
              y * size <= b[3] + size &&
              (y + 1) * size >= b[1] - size,
          )
        )
          continue;
        const name = `${x}-${y}.png`,
          local = `/assets/map-detail/${key}/${name}`;
        if (existing.has(name)) source.tiles[`${x},${y}`] = local;
        else
          jobs.push({
            source,
            x,
            y,
            file: path.join(dir, name),
            local,
            url: layer.tilePath
              .replace("{z}", z)
              .replace("{x}", x)
              .replace("{y}", y),
          });
      }
  }
}
console.log("Detail tiles queued:", jobs.length);
let cursor = 0,
  finished = 0,
  downloaded = 0,
  bytes = 0;
await Promise.all(
  Array.from({ length: 16 }, async () => {
    for (;;) {
      const job = jobs[cursor++];
      if (!job) return;
      for (let attempt = 0; attempt < 3; attempt++)
        try {
          const response = await fetch(job.url, {
            signal: AbortSignal.timeout(20000),
          });
          if (response.status === 404) break;
          if (!response.ok) throw Error("HTTP " + response.status);
          const buffer = Buffer.from(await response.arrayBuffer());
          if (
            !buffer
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          )
            throw Error("Not a PNG");
          await fs.writeFile(job.file, buffer);
          job.source.tiles[`${job.x},${job.y}`] = job.local;
          downloaded++;
          bytes += buffer.length;
          break;
        } catch (error) {
          if (attempt === 2)
            failures.push({ url: job.url, error: error.message });
        }
      if (++finished % 2000 === 0)
        console.log(
          "Processed",
          finished,
          "/",
          jobs.length,
          "downloaded",
          downloaded,
        );
    }
  }),
);
await fs.writeFile(
  path.join(root, "public/data/map-detail.json"),
  JSON.stringify(sources),
);
await fs.writeFile(
  path.join(root, "public/data/map-detail-report.json"),
  JSON.stringify({ downloaded, bytes, failures }, null, 2),
);
console.log(
  JSON.stringify({
    sources: Object.keys(sources).length,
    downloaded,
    bytes,
    failures: failures.length,
  }),
);
if (failures.length) process.exitCode = 1;
