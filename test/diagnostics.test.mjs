import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { Diagnostics } from "../server/diagnostics.mjs";
async function fixture(t) {
  await fs.mkdir("work", { recursive: true });
  const root = await fs.mkdtemp(path.resolve("work/diagnostics-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test("diagnostics are off by default, have no upload destination and create no event files without consent", async (t) => {
  const root = await fixture(t),
    d = new Diagnostics(root, "1.11.2");
  await d.ready;
  await d.record({ category: "startup", code: "started" });
  assert.equal(d.state().enabled, false);
  assert.equal(d.state().uploadConfigured, false);
  await assert.rejects(fs.stat(path.join(root, "diagnostics")));
});
test("explicit versioned consent records only allowed fields and revocation deletes the report", async (t) => {
  const root = await fixture(t),
    d = new Diagnostics(root, "1.11.2");
  await d.ready;
  await assert.rejects(d.consent(true, 999));
  assert.equal(d.enabled, false);
  await d.consent(true, 1);
  await d.record({
    category: "interface",
    code: "ui-error",
    message: "private path C:/Users/secret",
  });
  assert.equal(d.events.length, 0);
  await d.record({ category: "interface", code: "ui-error", durationMs: 1234 });
  assert.equal(d.events.length, 1);
  assert.deepEqual(Object.keys(d.events[0]).sort(), [
    "at",
    "category",
    "code",
    "durationMs",
  ]);
  assert.equal(d.events[0].durationMs, 1200);
  assert.equal(JSON.stringify(d.report()).includes("secret"), false);
  const restarted = new Diagnostics(root, "1.11.2");
  await restarted.ready;
  assert.equal(restarted.enabled, true);
  assert.equal(restarted.events.length, 1);
  await restarted.consent(false, 1);
  await assert.rejects(fs.stat(path.join(root, "diagnostics/report.json")));
  assert.equal(restarted.events.length, 0);
});
test("diagnostic retention is bounded, deduplicates repeated errors and ignores outdated events", async (t) => {
  const root = await fixture(t);
  let clock = Date.now();
  const d = new Diagnostics(root, "1.11.2", { clock: () => clock });
  await d.ready;
  await d.consent(true, 1);
  for (let i = 0; i < 310; i++) {
    clock += 31000;
    await d.record({ category: "server", code: "operation-failed" });
  }
  assert.equal(d.events.length, 300);
  await d.record({ category: "server", code: "operation-failed" });
  assert.equal(d.events.length, 300);
  clock += 8 * 86400000;
  const restarted = new Diagnostics(root, "1.11.2", { clock: () => clock });
  await restarted.ready;
  assert.equal(restarted.events.length, 0);
});
test("diagnostics refuse redirected storage instead of writing outside user data", async (t) => {
  const root = await fixture(t),
    outside = path.join(root, "outside"),
    user = path.join(root, "user");
  await fs.mkdir(outside);
  await fs.mkdir(user);
  await fs.symlink(
    outside,
    path.join(user, "diagnostics"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const d = new Diagnostics(user, "1.11.2");
  await d.ready;
  await assert.rejects(d.consent(true, 1));
  assert.deepEqual(await fs.readdir(outside), []);
});
