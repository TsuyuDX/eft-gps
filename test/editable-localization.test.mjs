import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { interfaceTexts } from "../public/locales/index.js";
import { templates } from "../public/locales/templates.js";
import {
  setLanguage,
  t,
  textPair,
  installLocalization,
} from "../public/core/localization.js";
import { translatePattern } from "../public/core/english-patterns.js";
import { checkLocalization } from "../scripts/check-localization.mjs";
test("editable catalogues retain complete RU/EN values, native copies and template variables", async () => {
  assert.deepEqual(await checkLocalization(), []);
  assert.ok(Object.keys(interfaceTexts).length > 1000);
});
test("Russian copy edits apply to static DOM, attributes and explicit bilingual components without touching user notes", async () => {
  const { document, window } = parseHTML(
    '<html><body><h1>Карты</h1><input placeholder="Карты" value="Карты"><textarea>Карты</textarea><div data-no-translate>Карты</div></body></html>',
  );
  Object.assign(globalThis, {
    document,
    window,
    Event: window.Event,
    MutationObserver: window.MutationObserver,
  });
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  const entry = interfaceTexts["Карты"],
    old = entry.ru;
  try {
    entry.ru = "Карты локаций";
    setLanguage("ru", { persist: false });
    installLocalization();
    assert.equal(document.querySelector("h1").textContent, "Карты локаций");
    assert.equal(
      document.querySelector("input").getAttribute("placeholder"),
      "Карты локаций",
    );
    assert.equal(
      document.querySelector("input").getAttribute("value"),
      "Карты",
    );
    assert.equal(document.querySelector("textarea").textContent, "Карты");
    assert.equal(
      document.querySelector("[data-no-translate]").textContent,
      "Карты",
    );
    assert.equal(textPair("Карты", "Fallback"), "Карты локаций");
    setLanguage("en", { persist: false });
    assert.equal(document.querySelector("h1").textContent, "Maps");
    assert.equal(textPair("Карты", "Fallback"), "Maps");
    setLanguage("ru", { persist: false });
    assert.equal(document.querySelector("h1").textContent, "Карты локаций");
    assert.equal(t("  Карты  "), "  Карты локаций  ");
  } finally {
    entry.ru = old;
  }
});
test("template substitutions preserve values and unknown new labels keep their safe fallback", () => {
  const { document, window } = parseHTML("<html><body></body></html>");
  Object.assign(globalThis, { document, window, Event: window.Event });
  setLanguage("en", { persist: false });
  assert.equal(translatePattern("5-й этаж"), "Floor 5");
  assert.equal(
    textPair("Новая подпись для теста", "New test label"),
    "New test label",
  );
  setLanguage("ru", { persist: false });
  assert.equal(
    textPair("Новая подпись для теста", "New test label"),
    "Новая подпись для теста",
  );
  assert.ok(templates.length > 20);
});
