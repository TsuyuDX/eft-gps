import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { gpsPointerSvg } from "../public/features/map-presentation.js";
const read = async (p) =>
  JSON.parse(await fs.readFile("public/data/" + p, "utf8"));
const slugs = [
  "halloween-rumors",
  "halloween-better-defence",
  "halloween-control-check",
  "halloween-unexpected-help",
];
test("Halloween quests are searchable and complete in both languages and game modes without changing progress IDs", async () => {
  const ids = new Map();
  for (const locale of ["", "en/"])
    for (const mode of ["regular", "pve"]) {
      const list = await read(locale + mode + "/quests.json"),
        search = await read(locale + mode + "/quest-search.json");
      for (const slug of slugs) {
        assert.equal(list.filter((q) => q.normalizedName === slug).length, 1);
        const q = (
          await read(
            locale +
              (mode === "pve" ? "pve/" : "") +
              "quests/" +
              slug +
              ".json",
          )
        ).quest;
        assert.equal(q.eventSlug, "halloween-2026");
        assert.equal(q.minPlayerLevel, 1);
        assert.ok(q.guide.length >= 3);
        assert.ok(q.objectives.length >= 2);
        assert.ok(search[slug].text.includes(q.name));
        const key = slug;
        const objectiveIds = q.objectives.map((o) => o.id);
        if (ids.has(key)) assert.deepEqual(objectiveIds, ids.get(key));
        else ids.set(key, objectiveIds);
        if (slug === "halloween-control-check")
          assert.equal(
            q.objectives[1].items[0].normalizedName,
            "medical-tools",
          );
        if (slug === "halloween-unexpected-help")
          assert.equal(
            q.objectives[1].requiredKeys[0][0].normalizedName,
            "dorm-room-105-key",
          );
        for (const image of q.guide.filter((n) => n.type === "image")) {
          assert.match(image.src, /^\/assets\//);
          assert.ok((await fs.stat("public" + image.src)).size > 0);
        }
      }
    }
});
test("event overview is indexed offline in English and Russian with all four task links", async () => {
  for (const locale of ["", "en/"]) {
    assert.ok(
      (await read(locale + "articles.json")).some(
        (a) => a.path === "event/halloween-2026-6",
      ),
    );
    const a = await read(locale + "articles/event__halloween-2026-6.json");
    for (const slug of slugs)
      assert.ok(a.html.includes("/quest/:mode/" + slug));
    assert.doesNotMatch(a.html, /<script|onload=/i);
  }
  const index = await read("en/index.json");
  for (const slug of slugs)
    assert.ok(index.files.includes("quests/" + slug + ".json"));
  assert.deepEqual(
    (await read("halloween-2026-report.json")).mediaFailures,
    [],
  );
});
test("Index navigation arrow replaces both ordinary styles only when explicitly enabled", () => {
  const classic = gpsPointerSvg("classic"),
    modern = gpsPointerSvg("new");
  assert.doesNotMatch(classic, /gps-index-arrow/);
  assert.doesNotMatch(modern, /gps-index-arrow/);
  assert.equal(
    gpsPointerSvg("classic", { secret: true }),
    gpsPointerSvg("new", { secret: true }),
  );
  assert.match(gpsPointerSvg("new", { secret: true }), /gps-index-arrow/);
  assert.match(gpsPointerSvg("new", { secret: true }), /viewBox="0 0 40 40"/);
});
