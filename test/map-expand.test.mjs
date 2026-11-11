import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { bindMapExpansion } from "../public/features/map-expand.js";
import { mapMarkers } from "../public/features/maps.js";
import { createHazardOverlay } from "../public/features/map-hazards.js";
import { markerFacts } from "../public/features/map-presentation.js";
import fs from "node:fs/promises";

test("expanded map has an accessible exit, restores panels without changing their state and defers Escape to an open dialog", () => {
  const { document, window } = parseHTML(
    '<html><body><main><section class="map-workspace"><div class="map-top"><button id="map-full"></button></div><div class="map-layout filters-collapsed"><aside id="original-panel">saved filters</aside></div></section></main><dialog></dialog></body></html>',
  );
  const saved = { document: globalThis.document, window: globalThis.window };
  Object.assign(globalThis, { document, window });
  try {
    const root = document.querySelector("main"),
      trigger = root.querySelector("#map-full"),
      panel = root.querySelector("aside");
    let focused = 0;
    trigger.focus = () => focused++;
    bindMapExpansion(root);
    const exit = root.querySelector("#map-exit-expanded");
    assert.equal(exit.hidden, true);
    trigger.onclick();
    assert.equal(document.body.classList.contains("map-is-expanded"), true);
    assert.equal(exit.hidden, false);
    assert.ok(exit.getAttribute("aria-label").includes("Esc"));
    const event = () => {
      const e = new window.Event("keydown", {
        bubbles: true,
        cancelable: true,
      });
      e.key = "Escape";
      return e;
    };
    document.querySelector("dialog").setAttribute("open", "");
    document.dispatchEvent(event());
    assert.equal(exit.hidden, false);
    document.querySelector("dialog").removeAttribute("open");
    document.dispatchEvent(event());
    assert.equal(exit.hidden, true);
    assert.equal(focused, 1);
    assert.equal(root.querySelector("aside"), panel);
    assert.ok(
      root.querySelector(".map-layout").classList.contains("filters-collapsed"),
    );
    trigger.onclick();
    exit.onclick();
    assert.equal(exit.hidden, true);
    trigger.onclick();
    window.dispatchEvent(new window.Event("view-changing"));
    assert.equal(document.body.classList.contains("map-is-expanded"), false);
  } finally {
    Object.assign(globalThis, saved);
  }
});

test("disputed Lighthouse bridge rectangles stay unshaded while warning markers and user-observation provenance remain", async () => {
  const saved = globalThis.document;
  const { document } = parseHTML("<svg></svg>");
  globalThis.document = document;
  try {
    for (const prefix of ["", "pve/"]) {
      const map = JSON.parse(
          await fs.readFile(
            "public/data/" + prefix + "maps/lighthouse.json",
            "utf8",
          ),
        ).map,
        markers = mapMarkers(map),
        bridge = markers.filter((m) => m.bridgeBarrierObservation);
      assert.equal(bridge.length, 4);
      assert.ok(bridge.every((m) => m.outlineSuppressed));
      assert.match(markerFacts(bridge[0]).join(" "), /наблюдению игрока/);
      const svg = document.querySelector("svg");
      createHazardOverlay(svg, map).render(bridge);
      assert.equal(svg.querySelectorAll("polygon").length, 0);
      assert.ok(bridge.every((m) => m.outline.length >= 3));
      const other = markers.find(
        (m) => m.hazardType === "sniper" && !m.bridgeBarrierObservation,
      );
      createHazardOverlay(svg, map).render([other]);
      assert.equal(svg.querySelectorAll("polygon").length, 1);
    }
  } finally {
    globalThis.document = saved;
  }
});
