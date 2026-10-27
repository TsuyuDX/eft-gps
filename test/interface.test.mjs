import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { parentRoute } from "../public/core/back-navigation.js";
import { normalizePreferences, preferenceDefaults } from "../public/core/preferences.js";
import { db } from "../public/core/data.js";
import { renderArticleList } from "../public/features/articles.js";
import { installAppNavigation } from "../public/core/navigation.js";
import { floorLabel } from "../public/core/map-labels.js";

test("internal and external links retain keyboard navigation without URL previews", () => {
  const { document, window } = parseHTML('<a href="#/trader/regular">Торговцы</a><a href="https://www.tarkovhead.com/ru">Источник</a>');
  globalThis.MutationObserver = window.MutationObserver;
  const opened = [];
  const host = { location: { href: "http://127.0.0.1:38471/", origin: "http://127.0.0.1:38471" }, open: (...args) => opened.push(args) };
  installAppNavigation(document, host);
  const [internal, external] = document.querySelectorAll("a");
  assert.equal(internal.hasAttribute("href"), false);
  assert.equal(external.hasAttribute("href"), false);
  const enter = new window.Event("keydown", { bubbles: true, cancelable: true });
  enter.key = "Enter";
  internal.dispatchEvent(enter);
  assert.equal(host.location.hash, "#/trader/regular");
  const externalEnter = new window.Event("keydown", { bubbles: true, cancelable: true });
  externalEnter.key = "Enter";
  external.dispatchEvent(externalEnter);
  assert.deepEqual(opened[0], ["https://www.tarkovhead.com/ru", "_blank", "noopener"]);
});

test("map floor labels translate levels without changing unknown source labels", () => {
  assert.equal(floorLabel("2nd Floor"), "2-й этаж");
  assert.equal(floorLabel("Bridge Roof"), "Крыша мостика");
  assert.equal(floorLabel("Палуба"), "Палуба");
});

test("detail return stays inside the correct section and game mode", () => {
  assert.deepEqual(parentRoute("#/trader/pve/prapor"), { hash: "#/trader/pve", label: "Торговцы", section: "trader" });
  assert.equal(parentRoute("#/boss/regular/big-pipe?q=123").hash, "#/boss/regular");
  assert.equal(parentRoute("#/event/blackout").hash, "#/event");
  assert.equal(parentRoute("#/trader/regular"), null);
  assert.equal(parentRoute("#/settings"), null);
});
test("corrupted or old preferences retain safe visible defaults", () => {
  assert.deepEqual(normalizePreferences(null), preferenceDefaults);
  const prefs = normalizePreferences({ sidebar: false, clock: "false", unknown: false });
  assert.equal(prefs.sidebar, false);
  assert.equal(prefs.clock, true);
  assert.equal("unknown" in prefs, false);
});
test("section index never appears as a trader card and search handles ё", () => {
  const { document } = parseHTML("<main></main>");
  globalThis.document = document;
  db.articles = [
    { type: "trader", path: "trader/regular", title: "Торговцы" },
    { type: "trader", path: "trader/regular/jaeger", title: "Егерь" },
    { type: "trader", path: "trader/regular/prapor", title: "Прапор" },
  ];
  const root = document.querySelector("main");
  renderArticleList(root, "trader");
  assert.equal(root.querySelectorAll(".article-card").length, 2);
  const search = root.querySelector("input");
  search.value = "ёгерь";
  search.oninput();
  assert.equal(root.querySelectorAll(".article-card:not([hidden])").length, 1);
  search.value = "неизвестно";
  search.oninput();
  assert.equal(root.querySelector(".empty").hidden, false);
});
