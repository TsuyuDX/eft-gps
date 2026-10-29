import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseHTML } from "linkedom";
import { mapMarkers } from "../public/features/maps.js";
import { markerIcon, markerIconName } from "../public/core/map-icons.js";
import { markerTheme } from "../public/core/map-marker-theme.js";
import { clusterMarkers } from "../public/features/map-clusters.js";
import {
  buildMapSearchIndex,
  matchingMapMarkers,
  createUnifiedMapSearch,
} from "../public/features/map-search.js";
import { db } from "../public/core/data.js";
import { projectPoint } from "../public/core/domain.js";
import { uiIcon } from "../public/core/icons.js";
test("every marker in both game modes resolves to its actual themed SVG and a finite projection", async () => {
  let total = 0,
    maps = 0;
  const used = new Set();
  for (const mode of ["", "pve/"])
    for (const file of await fs.readdir("public/data/" + mode + "maps")) {
      if (!file.endsWith(".json")) continue;
      const map = JSON.parse(
        await fs.readFile("public/data/" + mode + "maps/" + file),
      ).map;
      if (!map) continue;
      maps++;
      for (const marker of mapMarkers(map)) {
        total++;
        const name = markerIconName(marker, map);
        assert.ok(
          Object.hasOwn(markerTheme.icons, name),
          mode + file + " " + marker.group + " " + name,
        );
        const icon = markerIcon(marker, map);
        assert.equal(icon, markerTheme.icons[name]);
        used.add(icon);
        const p = projectPoint(marker.position, map);
        assert.ok(
          Number.isFinite(p.x) && Number.isFinite(p.y),
          mode + file + " invalid position",
        );
      }
    }
  for (const icon of Object.values(markerTheme.icons)) {
    const svg = await fs.readFile("public" + icon, "utf8");
    assert.match(svg, /<svg[^>]+viewBox="-3 -3 50 50"/);
    assert.doesNotMatch(svg, /<script|onload=|href="https?:/);
    assert.ok(svg.includes('stroke="#030507"'), "Missing map contrast outline");
  }
  assert.ok(total > 30000);
  assert.equal(maps, 28);
  assert.ok(used.size > 40);
});
test("close marker clusters preserve every source point and separate when zoomed", () => {
  const points = [
    { i: 0, p: { x: 10, y: 10 } },
    { i: 1, p: { x: 11, y: 10 } },
    { i: 2, p: { x: 80, y: 80 } },
  ];
  const grouped = clusterMarkers(points, 100, 100);
  assert.equal(grouped.length, 2);
  assert.deepEqual(
    grouped.flatMap((g) => g.entries.map((e) => e.i)).sort(),
    [0, 1, 2],
  );
  assert.equal(clusterMarkers(points, 4000, 4000).length, 3);
  assert.deepEqual(points[0].p, { x: 10, y: 10 });
});
test("one search finds quest objectives, containers and items and combines selected quests", () => {
  const markers = [
    { group: "quests", title: "Point A", quest: { normalizedName: "quest-a" } },
    { group: "quests", title: "Point B", quest: { normalizedName: "quest-b" } },
    {
      group: "lootContainers",
      title: "Ящик",
      lootContainer: { name: "Медицинский ящик" },
    },
    {
      group: "lootLoose",
      title: "Сахар",
      items: [{ id: "sugar-id", normalizedName: "sugar", name: "Сахар" }],
    },
  ];
  const rows = buildMapSearchIndex({
    markers,
    metadata: { "quest-a": { text: "Найти документы в офисе" } },
    quests: [
      { normalizedName: "quest-a", name: "Задание А" },
      { normalizedName: "quest-b", name: "Задание Б" },
    ],
    items: [{ id: "sugar-id", normalizedName: "sugar", name: "Сахар" }],
    map: {},
  });
  assert.deepEqual(
    [...matchingMapMarkers(markers, rows, "документы", [])],
    [0],
  );
  assert.deepEqual(
    [...matchingMapMarkers(markers, rows, "медицинский", [])],
    [2],
  );
  assert.equal(matchingMapMarkers(markers, rows, "", []), null);
  assert.deepEqual(
    [
      ...matchingMapMarkers(markers, rows, "", [
        rows.find((r) => r.id === "quest:quest-a"),
        rows.find((r) => r.id === "quest:quest-b"),
      ]),
    ],
    [0, 1],
  );
  assert.deepEqual(
    [
      ...matchingMapMarkers(markers, rows, "", [
        rows.find((r) => r.id === "item:sugar"),
      ]),
    ],
    [3],
  );
});
test("universal search UI selects multiple quests and clears back to saved filters", () => {
  const { document, window } = parseHTML(
    '<html><body><div id="search"></div></body></html>',
  );
  const originals = {
    document: globalThis.document,
    window: globalThis.window,
  };
  globalThis.document = document;
  globalThis.window = window;
  const saved = {
    quests: db.quests,
    items: db.items,
    maps: db.maps,
    articles: db.articles,
  };
  db.quests = [
    { name: "Alpha", normalizedName: "a" },
    { name: "Beta", normalizedName: "b" },
  ];
  db.items = [];
  db.maps = [];
  db.articles = [];
  const changes = [];
  try {
    const panel = createUnifiedMapSearch(document.querySelector("#search"), {
      markers: [
        { group: "quests", quest: { normalizedName: "a" }, title: "A" },
        { group: "quests", quest: { normalizedName: "b" }, title: "B" },
      ],
      metadata: {},
      map: {},
      onChange: (s) => changes.push(s),
      onFocus() {},
      onMarker() {},
      onQuest() {},
    });
    panel.selectQuest("a");
    panel.selectQuest("b");
    assert.deepEqual(changes.at(-1).selectedQuests, ["a", "b"]);
    assert.equal(document.querySelectorAll("[data-remove-search]").length, 2);
    panel.selectQuest("");
    assert.equal(changes.at(-1).indices, null);
    assert.equal(document.querySelectorAll("input[type=search]").length, 1);
  } finally {
    Object.assign(db, saved);
    globalThis.document = originals.document;
    globalThis.window = originals.window;
  }
});
test("button icons share a centered 24px coordinate system and are independent of text baselines", () => {
  for (const name of [
    "close",
    "left",
    "right",
    "plus",
    "minus",
    "home",
    "expand",
    "collapse",
  ]) {
    const { document } = parseHTML(uiIcon(name));
    const svg = document.querySelector("svg");
    assert.equal(svg.getAttribute("viewBox"), "0 0 24 24");
    assert.equal(svg.getAttribute("aria-hidden"), "true");
    assert.equal(svg.querySelectorAll("text").length, 0);
  }
});
