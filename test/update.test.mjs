import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commitSnapshot } from "../scripts/update-transaction.mjs";
import { validWindowSettings } from "../server/window-settings.mjs";
import { renderQuestPlan } from "../public/features/quest-plan.js";
import { propertyValue } from "../public/core/item-properties.js";
import { db } from "../public/core/data.js";
test("item values display readable booleans, percentages and source enums", () => {
  assert.equal(propertyValue("tracer", false), "Нет");
  assert.equal(propertyValue("fragmentationChance", 0.38), "38");
  assert.equal(propertyValue("ergoPenalty", -0.025), "-2,5");
  assert.equal(propertyValue("material", "ArmoredSteel"), "Броневая сталь");
  assert.equal(propertyValue("caliber", "Caliber9x18PM"), "9×18PM");
});

test("snapshot commit rolls back every moved directory on failure", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tarkov-update-test-"));
  const staged = path.join(root, "update-staging");
  for (const [folder, content] of [
    [root, "old"],
    [staged, "new"],
  ])
    for (const name of ["data", "assets"]) {
      fs.mkdirSync(path.join(folder, "public", name), { recursive: true });
      fs.writeFileSync(path.join(folder, "public", name, "value"), content);
    }
  fs.mkdirSync(path.join(root, "userdata"));
  fs.writeFileSync(path.join(root, "userdata/profile.json"), "progress");
  let step = 0;
  assert.throws(
    () =>
      commitSnapshot(root, staged, {
        rename(from, to) {
          if (++step === 4) throw Error("disk failure");
          fs.renameSync(from, to);
        },
      }),
    /disk failure/,
  );
  for (const name of ["data", "assets"]) {
    assert.equal(
      fs.readFileSync(path.join(root, "public", name, "value"), "utf8"),
      "old",
    );
    assert.equal(
      fs.readFileSync(path.join(staged, "public", name, "value"), "utf8"),
      "new",
    );
  }
  commitSnapshot(root, staged);
  assert.equal(
    fs.readFileSync(path.join(root, "public/data/value"), "utf8"),
    "new",
  );
  assert.equal(
    fs.readFileSync(path.join(root, "userdata/profile.json"), "utf8"),
    "progress",
  );
  // This uniquely created fixture is wholly inside the system temporary directory.
  fs.rmSync(root, { recursive: true });
});
test("window settings cannot overwrite progress or accept arbitrary storage keys", () => {
  assert.equal(
    validWindowSettings({
      version: 1,
      values: {
        "tarkov-interface-v1": '{"clock":false}',
        "map-filters-v2-pve-customs": '{"active":["extracts"]}',
      },
    }),
    true,
  );
  assert.equal(
    validWindowSettings({ version: 1, values: { "tarkov-offline-v1": "{}" } }),
    false,
  );
  assert.equal(
    validWindowSettings({
      version: 1,
      values: { "map-filters-v2-pve-../profile": "{}" },
    }),
    false,
  );
  assert.equal(
    validWindowSettings({
      version: 1,
      values: { "tarkov-interface-v1": "bad json" },
    }),
    false,
  );
});
test("brief quest plan uses actual objectives, keys and maps without inventing locations", () => {
  db.maps = [{ normalizedName: "customs" }];
  const html = renderQuestPlan(
    {
      normalizedName: "test-quest",
      objectives: [
        {
          description: "<Найти документ>",
          count: 1,
          foundInRaid: true,
          maps: [
            { name: "Таможня", normalizedName: "customs" },
            { name: "Учебная карта", normalizedName: "missing-training-map" },
          ],
          requiredKeys: [[{ name: "Ключ", normalizedName: "test-key" }]],
        },
      ],
    },
    "pve",
  );
  assert.match(html, /&lt;Найти документ&gt;/);
  assert.match(html, /#\/map\/pve\/customs\?quest=test-quest/);
  assert.match(html, /#\/item\/pve\/test-key/);
  assert.match(html, /Найдено в рейде/);
  assert.doesNotMatch(html, /missing-training-map/);
  assert.doesNotMatch(renderQuestPlan({ objectives: [] }, "regular"), /#\/map/);
});
