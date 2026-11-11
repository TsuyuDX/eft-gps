import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { EventEmitter } from "node:events";
import {
  buildSearchIndex,
  searchEntries,
} from "../public/core/global-search.js";
import { ViewCache } from "../public/core/view-cache.js";
import { OverlayManager } from "../server/overlay.mjs";
import { validWindowSettings } from "../server/window-settings.mjs";
test("global keyword search covers every section, bilingual aliases, fragments, punctuation and variants", () => {
  const data = {
    mode: "pve",
    items: [
      {
        name: "Аптечка АИ-2",
        normalizedName: "ai-2-medkit",
        description: "Лечение ран",
      },
    ],
    quests: [{ name: "Проверка", normalizedName: "debut" }],
    maps: [
      { name: "Завод", normalizedName: "factory", routeSlug: "factory" },
      {
        name: "Ночной Завод",
        normalizedName: "factory",
        routeSlug: "night-factory",
      },
    ],
    lookup: {
      traders: { prapor: { name: "Прапор", normalizedName: "prapor" } },
      hideout: {
        medstation: { name: "Медблок", normalizedName: "medstation" },
      },
    },
    articles: [
      { type: "boss", title: "Решала", path: "boss/reshala" },
      { type: "event", title: "Хэллоуин", path: "event/halloween" },
      { type: "season", title: "Kord Breach", path: "season/kord-breach" },
    ],
    news: [
      { slug: "new-build", title: "Новая версия", summary: "Удобный поиск" },
    ],
  };
  const index = buildSearchIndex(data, {
    items: [{ name: "AI-2 Medkit", normalizedName: "ai-2-medkit" }],
    quests: [{ name: "Debut", normalizedName: "debut" }],
  });
  for (const query of [
    "АПТЕЧ",
    "AI-2 med",
    "лечение аптеч",
    "DEBUT",
    "медбл",
    "прап",
    "решал",
    "хэлло",
    "kord",
    "удобный поиск",
  ])
    assert.ok(searchEntries(index, query).length, query);
  assert.equal(searchEntries(index, "завод").length, 2);
  assert.ok(searchEntries(index, "ночной")[0].href.endsWith("/night-factory"));
  assert.equal(searchEntries(index, "лечение неизвестный").length, 0);
  assert.equal(searchEntries(index, " ").length, 0);
  assert.equal(new Set(index.map((x) => x.type)).size, 9);
  const crowded = buildSearchIndex(
    {
      ...data,
      items: [
        ...Array.from({ length: 20 }, (_, i) => ({
          name: "Автомат Сайга " + i,
          normalizedName: "saiga-12-" + i,
        })),
        ...data.items,
      ],
    },
    { items: [{ name: "AI-2 Medkit", normalizedName: "ai-2-medkit" }] },
  );
  assert.equal(
    searchEntries(crowded, "AI-2")[0].href,
    "#/item/pve/ai-2-medkit",
  );
});
test("returning to a cached list preserves the actual input nodes, handlers, filters and scroll position", () => {
  const { document } = parseHTML(
    '<main><input id="q" value="лекар"><input id="fav" type="checkbox" checked><select id="sort"><option selected>price-desc</option></select><button>Page 4</button></main>',
  );
  const root = document.querySelector("main"),
    field = root.querySelector("input"),
    button = root.querySelector("button");
  let clicks = 0;
  button.onclick = () => clicks++;
  root.scrollTop = 1250;
  root.scrollLeft = 8;
  const cache = new ViewCache(2);
  cache.save("ru:pve:items", root, { cache: true });
  root.innerHTML = "<article>Item details</article>";
  assert.equal(cache.restore("ru:pve:items", root), true);
  assert.equal(root.querySelector("#q"), field);
  assert.equal(field.value, "лекар");
  assert.ok(
    root.querySelector("#fav").checked ||
      root.querySelector("#fav").hasAttribute("checked"),
  );
  root.querySelector("button").onclick();
  assert.equal(clicks, 1);
  assert.deepEqual(cache.position("ru:pve:items"), { top: 1250, left: 8 });
  assert.equal(cache.restore("en:pve:items", root), false);
});
test("overlay is off without a process and only its own process is started and stopped on explicit selection", async () => {
  let calls = 0,
    child;
  const manager = new OverlayManager("C:/fixture", 38479, {
    platform: "win32",
    spawnProcess: (exe, args) => {
      calls++;
      assert.ok(exe.endsWith("EFTGPSOverlay.exe"));
      assert.deepEqual(args, ["--app-port", "38479"]);
      child = new EventEmitter();
      child.exitCode = null;
      child.unref = () => {};
      child.kill = () => {
        child.exitCode = 0;
        child.emit("exit", 0);
      };
      setImmediate(() => child.emit("spawn"));
      return child;
    },
  });
  assert.deepEqual(manager.state(), {
    enabled: false,
    running: false,
    error: "",
  });
  await manager.setEnabled(false);
  assert.equal(calls, 0);
  await Promise.all([manager.setEnabled(true), manager.setEnabled(true)]);
  assert.equal(calls, 1);
  assert.equal(manager.state().running, true);
  const stopped = manager.setEnabled(false);
  await new Promise(setImmediate);
  assert.equal(manager.state().enabled, false);
  child.kill();
  await stopped;
  assert.equal(manager.state().running, false);
  await manager.setEnabled(true);
  assert.equal(calls, 2);
  manager.dispose();
  assert.equal(manager.state().running, false);
});
test("overlay settings persist through the existing settings schema and reject arbitrary launch parameters", () => {
  const setting = (data) => ({
    version: 1,
    values: { "tarkov-overlay-v1": JSON.stringify(data) },
  });
  assert.equal(validWindowSettings(setting({ enabled: true })), true);
  assert.equal(validWindowSettings(setting({ enabled: false })), true);
  for (const data of [
    { enabled: "true" },
    { enabled: true, path: "evil.exe" },
    { enabled: true, args: [] },
  ])
    assert.equal(validWindowSettings(setting(data)), false);
});

test("GPS off stops reading new screenshots and rapid toggles preserve configuration", async (t) => {
  const fs = await import("node:fs/promises"),
    path = await import("node:path"),
    os = await import("node:os");
  const { GpsService } = await import("../server/gps.mjs");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "eftgps-toggle-"));
  const shots = path.join(root, "shots");
  await fs.mkdir(shots);
  const service = new GpsService(root, { allowInput: false });
  t.after(async () => {
    service.stop();
    while (service.busy) await new Promise((resolve) => setTimeout(resolve, 5));
    await fs.rm(root, { recursive: true, force: true });
  });
  service.settings({
    screenshotsPath: shots,
    interval: 7,
    enabled: false,
    follow: true,
  });
  const first = "2026-11-12[14-01]_1, 2, 3_0, 0, 0, 1.png";
  await fs.writeFile(path.join(shots, first), "image");
  await service.tick();
  assert.equal(service.fix, null);
  service.settings({ enabled: true });
  while (service.busy) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(service.fix.position.x, 1);
  const pending = service.tick();
  service.settings({ enabled: false });
  await pending;
  assert.equal(service.state().config.enabled, false);
  assert.equal(service.state().auto, false);
  service.settings({ enabled: true });
  while (service.busy) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(service.state().config.interval, 7);
  assert.equal(service.state().config.follow, true);
  assert.equal(service.state().config.screenshotsPath, shots);
});

test("overlay can change its displayed mode without saving or changing the main profile on disk", async () => {
  const { setMode, profile } = await import("../public/core/state.js");
  const previous = profile().mode;
  const savedFetch = globalThis.fetch,
    savedStorage = globalThis.localStorage;
  let writes = 0;
  globalThis.fetch = async () => {
    writes++;
    throw Error("Unexpected profile write");
  };
  globalThis.localStorage = {
    setItem: () => {
      writes++;
    },
  };
  try {
    setMode(previous === "pve" ? "regular" : "pve", { persist: false });
    assert.notEqual(profile().mode, previous);
    assert.equal(writes, 0);
  } finally {
    setMode(previous, { persist: false });
    globalThis.fetch = savedFetch;
    globalThis.localStorage = savedStorage;
  }
});
