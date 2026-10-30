import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseHTML } from "linkedom";
import {
  pressSecretTheme,
  isSecretThemeActive,
  resetSecretTheme,
  secretMarkerIcon,
} from "../public/core/secret-theme.js";
test("secret theme activates only on the sixteenth press, leaves saved preferences alone and resets", async () => {
  const prior = { document: globalThis.document, window: globalThis.window };
  const { document } = parseHTML("<html><body></body></html>");
  globalThis.document = document;
  globalThis.window = new EventTarget();
  let events = 0;
  window.addEventListener("map-marker-style-changed", () => events++);
  try {
    assert.equal(isSecretThemeActive(), false);
    for (let i = 0; i < 15; i++) assert.equal(pressSecretTheme(), false);
    assert.equal(isSecretThemeActive(), false);
    assert.equal(
      document.documentElement.classList.contains("secret-maps-theme"),
      false,
    );
    assert.equal(pressSecretTheme(), true);
    assert.equal(events, 1);
    assert.equal(
      document.documentElement.classList.contains("secret-maps-theme"),
      true,
    );
    assert.equal(
      secretMarkerIcon("/assets/eft-gps-markers/hazard.svg"),
      "/assets/secret-maps-markers/hazard.svg",
    );
    assert.equal(pressSecretTheme(), false);
    assert.equal(events, 1);
    const freshSession =
      await import("../public/core/secret-theme.js?fresh-process-state");
    assert.equal(freshSession.isSecretThemeActive(), false);
    resetSecretTheme();
    assert.equal(isSecretThemeActive(), false);
    assert.equal(
      document.documentElement.classList.contains("secret-maps-theme"),
      false,
    );
    assert.equal(
      secretMarkerIcon("/assets/eft-gps-markers/hazard.svg"),
      "/assets/eft-gps-markers/hazard.svg",
    );
  } finally {
    globalThis.document = prior.document;
    globalThis.window = prior.window;
  }
});
test("secret theme has a complete safe offline icon set and no branding substitution", async () => {
  const originals = (await fs.readdir("public/assets/eft-gps-markers")).sort();
  const hidden = (await fs.readdir("public/assets/secret-maps-markers")).sort();
  assert.deepEqual(hidden, originals);
  for (const file of hidden) {
    const svg = await fs.readFile(
      "public/assets/secret-maps-markers/" + file,
      "utf8",
    );
    assert.match(svg, /viewBox="-3 -3 50 50"/);
    assert.doesNotMatch(
      svg,
      /<script|https?:\/\/(?!www.w3.org)|onload=|foreignObject/,
    );
    const { document } = parseHTML(svg);
    assert.equal(document.querySelectorAll("svg").length, 1);
  }
  const source = await fs.readFile("public/core/secret-theme.js", "utf8");
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage|writeWindowSetting|fetch\(/,
  );
});
