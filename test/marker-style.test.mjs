import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { db } from "../public/core/data.js";
import { markerIcon } from "../public/core/map-icons.js";
import {
  getMarkerStyle,
  setMarkerStyle,
  markerStyleKey,
} from "../public/core/marker-style.js";
import { validWindowSettings } from "../server/window-settings.mjs";
test("classic and new markers switch, persist, and validate without accepting unknown settings", async () => {
  const saved = {
    localStorage: globalThis.localStorage,
    window: globalThis.window,
    fetch: globalThis.fetch,
    assets: db.assets,
  };
  const values = new Map();
  globalThis.localStorage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    key: (i) => [...values.keys()][i],
    get length() {
      return values.size;
    },
  };
  globalThis.window = new EventTarget();
  globalThis.fetch = async () => ({ ok: true });
  try {
    db.assets = JSON.parse(
      await fs.readFile("public/data/assets.json", "utf8"),
    );
    const marker = { group: "extracts", faction: "pmc" };
    assert.equal(getMarkerStyle(), "new");
    const modern = markerIcon(marker);
    assert.match(modern, /eft-gps-markers.*svg$/);
    setMarkerStyle("classic");
    assert.equal(getMarkerStyle(), "classic");
    const classic = markerIcon(marker);
    assert.notEqual(classic, modern);
    assert.notEqual(classic, "/assets/fallback.svg");
    await fs.access("public" + classic);
    assert.equal(JSON.parse(values.get(markerStyleKey)).style, "classic");
    for (const style of ["new", "classic"])
      assert.equal(
        validWindowSettings({
          version: 1,
          values: { [markerStyleKey]: JSON.stringify({ style }) },
        }),
        true,
      );
    assert.equal(
      validWindowSettings({
        version: 1,
        values: { [markerStyleKey]: '{"style":"unknown"}' },
      }),
      false,
    );
    setMarkerStyle("new");
    assert.equal(markerIcon(marker), modern);
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    db.assets = saved.assets;
    for (const key of ["localStorage", "window", "fetch"])
      globalThis[key] = saved[key];
  }
});
