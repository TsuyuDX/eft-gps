import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ScreenshotCleanup } from "../server/screenshot-cleanup.mjs";
import { GpsService } from "../server/gps.mjs";
const shot = (n) =>
  `2026-10-26[14-01]_${n}, 4, -20_0, 0, 0, 1_14.08 (${n}).png`;
function fixture() {
  const base = path.resolve("work");
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, "gps-cleanup-test-"));
  const shots = path.join(root, "shots");
  fs.mkdirSync(shots);
  return {
    root,
    shots,
    dispose() {
      assert.ok(root.startsWith(base + path.sep));
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test("cleanup preserves baseline and unrelated files, waits for writes, and drains only already processed shots after stop", async () => {
  const f = fixture();
  let now = Date.now() - 1000;
  const cleanup = new ScreenshotCleanup({ now: () => now });
  try {
    const old = path.join(f.shots, shot(0)),
      fresh = path.join(f.shots, shot(1));
    fs.writeFileSync(old, "old screenshot");
    fs.writeFileSync(path.join(f.shots, "personal.png"), "personal");
    const session = cleanup.begin(f.shots);
    fs.writeFileSync(fresh, "new screenshot");
    cleanup.track(session, shot(0), fs.statSync(old));
    cleanup.track(
      session,
      "personal.png",
      fs.statSync(path.join(f.shots, "personal.png")),
    );
    cleanup.track(session, shot(1), fs.statSync(fresh));
    await cleanup.flush();
    assert.ok(fs.existsSync(fresh));
    fs.appendFileSync(fresh, " still writing");
    now = Date.now() + 3000;
    await cleanup.flush();
    assert.ok(fs.existsSync(fresh));
    now += 2100;
    await cleanup.flush();
    assert.equal(fs.existsSync(fresh), false);
    const queued = path.join(f.shots, shot(2));
    fs.writeFileSync(queued, "processed");
    cleanup.track(session, shot(2), fs.statSync(queued));
    cleanup.end();
    const manual = path.join(f.shots, shot(3));
    fs.writeFileSync(manual, "manual after stop");
    cleanup.track(session, shot(3), fs.statSync(manual));
    now += 2100;
    await cleanup.flush();
    assert.equal(fs.existsSync(queued), false);
    assert.ok(fs.existsSync(manual));
    assert.ok(fs.existsSync(old));
    assert.ok(fs.existsSync(path.join(f.shots, "personal.png")));
    assert.equal(cleanup.state().deleted, 2);
    assert.ok(cleanup.state().bytes > 0);
  } finally {
    f.dispose();
  }
});

test("cleanup refuses replaced files and cancelled work", async () => {
  const f = fixture();
  let now = Date.now() - 1000;
  const cleanup = new ScreenshotCleanup({ now: () => now });
  try {
    const session = cleanup.begin(f.shots),
      file = path.join(f.shots, shot(4));
    fs.writeFileSync(file, "captured");
    cleanup.track(session, shot(4), fs.statSync(file));
    fs.renameSync(file, path.join(f.shots, "preserved-original.png"));
    fs.writeFileSync(file, "replacement");
    now = Date.now() + 4000;
    await cleanup.flush();
    assert.equal(fs.readFileSync(file, "utf8"), "replacement");
    const next = path.join(f.shots, shot(5));
    fs.writeFileSync(next, "cancelled");
    // The injected clock advances independently of the filesystem timestamp.
    fs.utimesSync(next, new Date(now), new Date(now));
    cleanup.track(session, shot(5), fs.statSync(next));
    cleanup.cancel();
    now += 3000;
    await cleanup.flush();
    assert.ok(fs.existsSync(next));
    assert.equal(cleanup.deleted, 0);
  } finally {
    f.dispose();
  }
});

test("GPS keeps coordinates after automatic cleanup, preserves manual mode and honours the cleanup switch", async () => {
  const f = fixture();
  const gps = new GpsService(f.root, { allowInput: false });
  let now = Date.now() - 1000;
  try {
    gps.settings({ enabled: true, screenshotsPath: f.shots });
    while (gps.busy) await new Promise((r) => setTimeout(r, 5));
    assert.equal(gps.config.deleteAutoScreenshots, true);
    assert.throws(
      () => gps.settings({ deleteAutoScreenshots: "yes" }),
      /Неверная/,
    );
    gps.cleanup = new ScreenshotCleanup({ now: () => now });
    gps.cleanup.begin(f.shots);
    gps.auto = true;
    gps.state();
    const file = path.join(f.shots, shot(6));
    fs.writeFileSync(file, "automatic");
    await gps.tick();
    assert.deepEqual(gps.fix.position, { x: 6, y: 4, z: -20 });
    now = Date.now() + 3000;
    await gps.tick();
    assert.equal(fs.existsSync(file), false);
    assert.deepEqual(gps.fix.position, { x: 6, y: 4, z: -20 });
    gps.stopAuto();
    const manual = path.join(f.shots, shot(7));
    fs.writeFileSync(manual, "manual");
    await gps.tick();
    now += 3000;
    await gps.tick();
    assert.ok(fs.existsSync(manual));
    gps.settings({ deleteAutoScreenshots: false });
    while (gps.busy) await new Promise((r) => setTimeout(r, 5));
    gps.auto = true;
    gps.state();
    const keep = path.join(f.shots, shot(8));
    fs.writeFileSync(keep, "keep");
    await gps.tick();
    now += 3000;
    await gps.tick();
    assert.ok(fs.existsSync(keep));
    assert.equal(gps.fix.position.x, 8);
    const restarted = new GpsService(f.root, { allowInput: false });
    assert.equal(restarted.config.deleteAutoScreenshots, false);
    assert.equal(restarted.cleanup.pending.size, 0);
  } finally {
    gps.stop();
    f.dispose();
  }
});
