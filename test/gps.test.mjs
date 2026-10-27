import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseScreenshot,
  parseLogLine,
  mapName,
  floorFor,
} from "../public/core/gps-format.js";
import { GpsService } from "../server/gps.mjs";
test("GPS parses native screenshot names, negatives, quaternion and multi-digit suffix", () => {
  const f = parseScreenshot(
    "2026-10-25[14-01]_-49.90, 12.10, -51.80_0.0, 0.707106, 0.0, 0.707106_14.08 (12).png",
  );
  assert.deepEqual(f.position, { x: -49.9, y: 12.1, z: -51.8 });
  assert.ok(Math.abs(f.rotation - 90) < 0.001);
  assert.equal(parseScreenshot("Screenshot 2026-10-25.png"), null);
  assert.equal(
    parseScreenshot("2026-10-25[14-01]_1, 2, 3_0, 0, 0, 0.png"),
    null,
  );
  assert.equal(
    parseScreenshot("2026-10-25[14-01]_1, 2, 3_0, 0, 0, 1.exe"),
    null,
  );
});
test("GPS log events select a map and stop on match exit", () => {
  assert.equal(mapName("factory4_night"), "night-factory");
  assert.equal(mapName("city_preset"), "streets-of-tarkov");
  assert.deepEqual(
    parseLogLine(
      "2026-10-25 14:00:00.000|1|Info|application|scene preset path:maps/bigmap.bundle",
    ),
    { map: "customs", mode: null, raid: "loading" },
  );
  assert.equal(parseLogLine("Info|application|GameStarted").raid, "active");
  assert.equal(parseLogLine("Got notification | UserMatchOver").raid, "ended");
  assert.equal(parseLogLine("Session mode: PVE").mode, "pve");
  assert.equal(parseLogLine("unrelated line"), null);
});
test("GPS floor selection respects height and horizontal building bounds", () => {
  const map = {
    layers: [
      {
        extents: [{ height: [3, 6], bounds: [[[0, 0], [10, 10], "building"]] }],
      },
      { extents: [{ height: [6, 9] }] },
    ],
  };
  assert.equal(floorFor({ x: 5, y: 4, z: 5 }, map), 0);
  assert.equal(floorFor({ x: 50, y: 4, z: 50 }, map), "");
  assert.equal(floorFor({ x: 50, y: 7, z: 50 }, map), 1);
});
test("local GPS service reads filename coordinates, tails partial logs, and never sends keys in tests", async () => {
  const testBase = path.resolve("work");
  fs.mkdirSync(testBase, { recursive: true });
  const root = fs.mkdtempSync(path.join(testBase, "tarkov-gps-test-"));
  const shots = path.join(root, "shots"),
    logs = path.join(root, "logs");
  fs.mkdirSync(shots);
  fs.mkdirSync(logs);
  fs.mkdirSync(path.join(root, "public/data/maps"), { recursive: true });
  fs.writeFileSync(path.join(root, "public/data/maps/customs.json"), "{}");
  const gps = new GpsService(root, { allowInput: false });
  try {
    gps.settings({
      enabled: true,
      screenshotsPath: shots,
      logsPath: logs,
      map: "customs",
    });
    while (gps.busy) await new Promise((r) => setTimeout(r, 5));
    const log = path.join(logs, "application_000.log");
    fs.writeFileSync(
      log,
      "Info|application|scene preset path:maps/bigmap.bundle\nInfo|application|GameSta",
    );
    await gps.readLogs();
    assert.equal(gps.raid, "loading");
    fs.appendFileSync(log, "rted\n");
    await gps.readLogs();
    assert.equal(gps.raid, "active");
    const filename =
      "2026-10-25[14-01]_1.00, 4.00, -20.00_0.0, 0.0, 0.0, 1.0_14.08 (0).png";
    fs.writeFileSync(path.join(shots, filename), "coordinate-name-only");
    await gps.tick();
    assert.deepEqual(gps.fix.position, { x: 1, y: 4, z: -20 });
    assert.equal(gps.fix.map, "customs");
    assert.throws(() => gps.startAuto(true), /тестовом/);
    fs.appendFileSync(log, "Got notification | UserMatchOver\n");
    await gps.readLogs();
    assert.equal(gps.raid, "ended");
    assert.equal(gps.fix, null);
    assert.equal(gps.auto, false);
    const restarted = new GpsService(root, { allowInput: false });
    assert.equal(restarted.config.enabled, true);
    assert.equal(restarted.auto, false);
  } finally {
    gps.stop();
    assert.ok(root.startsWith(testBase + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
