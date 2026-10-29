import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseHTML } from "linkedom";
import {
  markerPresentation,
  gpsPointerSvg,
} from "../public/features/map-presentation.js";
import {
  createHazardOverlay,
  hazardOutline,
} from "../public/features/map-hazards.js";
import { clusterMarkers } from "../public/features/map-clusters.js";
import { mapMarkers } from "../public/features/maps.js";
test("destinations remain separate, named and labelled in either marker style", () => {
  const a = {
    x: { group: "extracts", title: "Gate 3", faction: "pmc" },
    i: 0,
    p: { x: 30, y: 30 },
  };
  const b = {
    x: { group: "hazards", hazardType: "sniper", title: "Sniper" },
    i: 1,
    p: { x: 30, y: 30 },
  };
  assert.equal(clusterMarkers([a, b], 100, 100).length, 2);
  assert.equal(markerPresentation(a.x).label, "Gate 3");
  assert.match(markerPresentation(a.x).description, /ЧВК/);
  assert.equal(markerPresentation({ ...a.x, group: "lootLoose" }).label, "");
  assert.equal(
    markerPresentation({
      title: "<b>Gate</b>",
      description: "<script>x</script>",
    }).name,
    "Gate",
  );
  assert.notEqual(gpsPointerSvg("new"), gpsPointerSvg("classic"));
  for (const style of ["new", "classic"])
    assert.match(gpsPointerSvg(style), /viewBox="0 0 40 40"/);
});
test("all actual sniper danger zones have valid local contours", async () => {
  let count = 0;
  for (const dir of ["public/data/maps", "public/data/pve/maps"])
    for (const file of await fs.readdir(dir)) {
      if (!file.endsWith(".json")) continue;
      const map = JSON.parse(await fs.readFile(dir + "/" + file)).map;
      if (!map) continue;
      for (const marker of mapMarkers(map))
        if (marker.group === "hazards" && marker.hazardType === "sniper") {
          const points = hazardOutline(marker, map);
          assert.ok(points?.length >= 3, file);
          assert.ok(
            points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
          );
          count++;
        }
    }
  assert.equal(count, 212);
});
test("hover exposes hidden hazard zones including muted floors and supports several selected zones", () => {
  const prior = globalThis.document;
  const { document } = parseHTML("<html><body><svg></svg></body></html>");
  globalThis.document = document;
  try {
    const map = { coordinateSystem: {} };
    // Use a real transform and real outline so this exercises the displayed data.
    return fs
      .readFile("public/data/maps/customs.json", "utf8")
      .then((raw) => {
        const map = JSON.parse(raw).map;
        const hazards = mapMarkers(map)
          .filter((m) => hazardOutline(m, map))
          .slice(0, 2);
        assert.equal(hazards.length, 2);
        const overlay = createHazardOverlay(document.querySelector("svg"), map);
        overlay.render(hazards, { all: false, muted: () => true });
        const nodes = [...document.querySelectorAll("polygon")];
        assert.ok(nodes.every((n) => n.hasAttribute("hidden")));
        overlay.highlight([0, 1]);
        assert.ok(
          nodes.every(
            (n) =>
              !n.hasAttribute("hidden") &&
              n.classList.contains("highlighted") &&
              n.classList.contains("other-floor"),
          ),
        );
        overlay.highlight(null);
        assert.ok(nodes.every((n) => n.hasAttribute("hidden")));
      })
      .finally(() => {
        globalThis.document = prior;
      });
  } catch (e) {
    globalThis.document = prior;
    throw e;
  }
});
test("every new icon has its own readable accent color", async () => {
  const colors = new Set();
  const files = (await fs.readdir("public/assets/eft-gps-markers")).filter(
    (n) => n.endsWith(".svg"),
  );
  for (const file of files) {
    const svg = await fs.readFile(
      "public/assets/eft-gps-markers/" + file,
      "utf8",
    );
    const accent = svg.match(/hsl\([^)]+\)/)?.[0];
    assert.ok(accent, file);
    assert.equal(colors.has(accent), false, file + " duplicate color");
    colors.add(accent);
    assert.match(svg, /stroke="#030507"/);
  }
  assert.equal(colors.size, 91);
});
