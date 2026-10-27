import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectPoint,
  requirements,
  modifierResult,
} from "../public/core/domain.js";
import { safePath, validProfile } from "../server.mjs";
import path from "node:path";
test("map projection follows rotation for corners and center", () => {
  const bounds = [
    [100, -100],
    [-100, 100],
  ];
  for (const rotation of [0, 90, 180, 270]) {
    const m = { bounds, coordinateRotation: rotation };
    const p = projectPoint({ x: 0, z: 0 }, m);
    assert.ok(Math.abs(p.x - 50) < 1e-8);
    assert.ok(Math.abs(p.y - 50) < 1e-8);
  }
  const corner = projectPoint(
    { x: 100, z: -100 },
    { bounds, coordinateRotation: 180 },
  );
  assert.ok(Math.abs(corner.x) < 1e-8 && Math.abs(corner.y) < 1e-8);
});
test("tracker excludes finished quests and completed hideout levels", () => {
  const e = {
    questsData: { q: { normalizedName: "debut" } },
    questsExtraData: { q: { totalCount: 3, foundInRaid: true } },
    hideoutData: { h: { normalizedName: "heating", level: 2 } },
    hideoutExtraData: { h: { totalCount: 5 } },
  };
  const p = { quests: {}, hideout: {} };
  assert.equal(requirements(e, p).count, 8);
  assert.equal(requirements(e, p, "quests").count, 3);
  p.quests.debut = true;
  assert.equal(requirements(e, p).count, 5);
  p.hideout.heating = 2;
  assert.equal(requirements(e, p).count, 0);
});
test("modifier calculator detects blocked combinations and negative balance", () => {
  const mods = [
    { id: "a", points: -3, locks: ["b"] },
    { id: "b", points: 5, conflicts: [] },
  ];
  assert.equal(modifierResult(mods, ["a"]).valid, false);
  assert.equal(modifierResult(mods, ["b"]).valid, true);
  assert.equal(modifierResult(mods, ["a", "b"]).conflicts.length, 1);
  assert.equal(modifierResult(mods, ["a", "b"]).valid, false);
});
test("static server confines files to the public folder", () => {
  const root = path.resolve("public");
  assert.equal(safePath(root, "/../server.mjs"), null);
  assert.equal(
    safePath(root, "/data/items.json"),
    path.join(root, "data/items.json"),
  );
  assert.equal(
    validProfile({ version: 1, modes: { regular: {}, pve: {} } }),
    true,
  );
  assert.equal(validProfile({ version: 0 }), false);
});
