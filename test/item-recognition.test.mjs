import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { ItemRecognition } from "../server/item-recognition.mjs";
import {
  itemNameIndex,
  matchItemLines,
  recognitionConfig,
  traderQuotes,
} from "../public/core/item-recognition-model.js";
const gpu = {
  name: "Видеокарта",
  normalizedName: "graphics-card",
  iconLink: "https://assets.tarkov.dev/57347ca924597744596b4e71-icon.webp",
};
test("OCR matches full Russian and English names and refuses generic or ambiguous text", () => {
  const index = itemNameIndex([
    gpu,
    { ...gpu, name: "Graphics card" },
    { name: "Болты", normalizedName: "bolts" },
  ]);
  assert.equal(
    matchItemLines(["Видеокарта"], index).normalizedName,
    "graphics-card",
  );
  assert.equal(
    matchItemLines(["Graphics", "card"], index).normalizedName,
    "graphics-card",
  );
  assert.equal(matchItemLines(["Видеокарта", "Болты"], index), null);
  assert.equal(matchItemLines(["Видеокарта памяти не найдена"], index), null);
  assert.equal(matchItemLines(["GPU"], index), null);
});
test("OCR settings clamp expensive intervals and reject unknown trader identifiers", () => {
  const x = recognitionConfig({
    interval: 0,
    duration: 100,
    traders: ["therapist", "injected"],
    enabled: false,
  });
  assert.equal(x.interval, 10);
  assert.equal(x.duration, 8);
  assert.deepEqual(x.traders, ["therapist"]);
  assert.equal(x.enabled, false);
});
test("sale recommendation uses ruble prices and confirmed unlocked traders, never flea gross as guaranteed net", () => {
  const x = traderQuotes(
    {
      lastLowPrice: 1000,
      types: [],
      sellFor: [
        { priceRUB: 200, vendor: { normalizedName: "therapist" } },
        { priceRUB: 250, vendor: { normalizedName: "jaeger" } },
        { priceRUB: 1000, vendor: { normalizedName: "flea-market" } },
      ],
    },
    recognitionConfig({ traders: ["therapist"] }),
  );
  assert.equal(x.best.priceRUB, 250);
  assert.equal(x.available.priceRUB, 200);
  assert.equal(x.flea, 1000);
});
test("disabled OCR launches no worker; enabled OCR reuses identical image and mode-aware price cache", async (t) => {
  const root = await fs.mkdtemp(
    path.join(process.cwd(), "work/recognition-test-"),
  );
  assert.ok(
    path
      .resolve(root)
      .startsWith(path.resolve("work") + path.sep + "recognition-test-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "public/data/regular"), { recursive: true });
  await fs.mkdir(path.join(root, "public/data/en/regular"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, "public/data/regular/items.json"),
    JSON.stringify([gpu]),
  );
  await fs.writeFile(
    path.join(root, "public/data/en/regular/items.json"),
    JSON.stringify([{ ...gpu, name: "Graphics card" }]),
  );
  const file = path.join(root, "capture.png");
  await fs.writeFile(
    file,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV8AAAAASUVORK5CYII=",
      "base64",
    ),
  );
  let workers = 0,
    requests = 0;
  const service = new ItemRecognition(root, {
    ocr: async () => {
      workers++;
      return { languages: ["ru", "en"], lines: ["Видеокарта"] };
    },
    fetcher: async () => {
      requests++;
      return new Response(
        JSON.stringify({
          data: {
            items: [
              {
                id: "57347ca924597744596b4e71",
                name: "Graphics card",
                lastLowPrice: 1000,
                types: [],
                sellFor: [],
              },
            ],
          },
        }),
      );
    },
  });
  await service.ready;
  await service.enqueue(file);
  assert.equal(workers, 0);
  await service.settings(recognitionConfig({ enabled: true, quests: false }));
  await service.enqueue(file);
  await service.pending;
  assert.equal(service.state.result.slug, "graphics-card");
  assert.equal(workers, 1);
  assert.equal(requests, 1);
  service.lastAt = 0;
  await service.enqueue(file);
  assert.equal(workers, 1);
  await service.price(gpu, "regular");
  assert.equal(requests, 1);
  assert.equal(
    (await fs.readdir(service.dir)).some((x) => x.endsWith(".png")),
    false,
  );
  await service.settings(recognitionConfig({ enabled: false }));
  assert.equal(service.state.result, null);
});
