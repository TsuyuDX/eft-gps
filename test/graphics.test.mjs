import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  original,
  normalizeGraphics,
  normalizeAdjustments,
  builtinPresets,
  validGraphics,
  filterValues,
} from "../public/core/graphics-model.js";
import { validWindowSettings } from "../server/window-settings.mjs";
import { GraphicsGallery, rasterInfo } from "../server/graphics-gallery.mjs";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("graphics profiles survive disk settings round-trip and reject malformed/unsafe values", () => {
  const data = normalizeGraphics({
    values: { brightness: 120, gamma: 1.2 },
    presets: [{ id: "my-forest", name: "Лес", values: { brightness: 130 } }],
  });
  assert.equal(validGraphics(data), true);
  assert.equal(
    validWindowSettings({
      version: 1,
      values: { "eftgps-graphics-v1": JSON.stringify(data) },
    }),
    true,
  );
  assert.deepEqual(normalizeGraphics(JSON.parse(JSON.stringify(data))), data);
  for (const mutate of [
    (v) => (v.values.gamma = 0),
    (v) => (v.values.intensity = Infinity),
    (v) => (v.presets[0].name = ""),
    (v) => v.presets.push(v.presets[0]),
  ]) {
    const v = structuredClone(data);
    mutate(v);
    assert.equal(validGraphics(v), false);
    assert.equal(
      validWindowSettings({
        version: 1,
        values: { "eftgps-graphics-v1": JSON.stringify(v) },
      }),
      false,
    );
  }
  assert.equal(
    normalizeAdjustments({ gamma: 900, contrast: -5, brightness: "unsafe" })
      .gamma,
    2,
  );
  assert.deepEqual(filterValues(original), {
    exponent: 1,
    slope: 1,
    intercept: 0,
    saturation: 1,
    red: 1,
    blue: 1,
    kernel: "0 0 0 0 1 0 0 0 0",
    intensity: 1,
  });
  for (const p of builtinPresets)
    assert.equal(
      validGraphics({ version: 1, values: p.values, presets: [] }),
      true,
    );
  assert.equal(filterValues({ ...original, gamma: 1.25 }).exponent, 0.8);
  assert.equal(filterValues({ ...original, intensity: 0 }).intensity, 0);
});
test("private screenshot gallery retains exact originals across restarts, confines deletions and rejects executable/oversized media", async (t) => {
  const dir = await fs.mkdtemp(path.join(process.cwd(), "work/graphics-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const gallery = new GraphicsGallery(dir),
    item = await gallery.add(png, "Лес");
  assert.equal(item.width, 1);
  assert.deepEqual(await gallery.image(item.id), png);
  const restarted = new GraphicsGallery(dir);
  assert.deepEqual(await restarted.list(), [item]);
  assert.deepEqual(await restarted.image(item.id), png);
  await assert.rejects(
    gallery.add(Buffer.from("<svg onload=alert(1)></svg>"), "x"),
  );
  assert.throws(() => rasterInfo(Buffer.alloc(12 * 1024 * 1024 + 1)));
  const huge = Buffer.from(png);
  huge.writeUInt32BE(9000, 16);
  assert.throws(() => rasterInfo(huge));
  assert.equal(await gallery.image("../../profile.json"), null);
  await assert.rejects(gallery.remove("../profile.json"));
  await fs.writeFile(path.join(dir, "profile.json"), "preserve");
  await gallery.remove(item.id);
  assert.deepEqual(await gallery.list(), []);
  assert.equal(
    await fs.readFile(path.join(dir, "profile.json"), "utf8"),
    "preserve",
  );
  assert.equal(await gallery.image(item.id), null);
});
test("gallery refuses junctions rather than writing images outside user storage", async (t) => {
  const dir = await fs.mkdtemp(
    path.join(process.cwd(), "work/graphics-junction-"),
  );
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const outside = path.join(dir, "outside"),
    user = path.join(dir, "userdata");
  await fs.mkdir(outside);
  await fs.mkdir(user);
  await fs.symlink(
    outside,
    path.join(user, "graphics-gallery"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const gallery = new GraphicsGallery(user);
  await assert.rejects(gallery.add(png, "Лес"), /папка/);
  assert.deepEqual(await fs.readdir(outside), []);
});
