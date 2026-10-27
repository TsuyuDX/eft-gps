import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseHTML } from "linkedom";
import {
  setLanguage,
  t,
  installLocalization,
} from "../public/core/localization.js";
import { json, init, db } from "../public/core/data.js";
import { openTour, hasSeenTour, openHelp } from "../public/features/help.js";
import { validWindowSettings } from "../server/window-settings.mjs";
function dom() {
  const { document, window } = parseHTML(
    '<html><body><dialog id="modal"><div id="modal-content"></div></dialog></body></html>',
  );
  Object.assign(globalThis, {
    document,
    window,
    Event: window.Event,
    MutationObserver: window.MutationObserver,
  });
  const values = new Map();
  globalThis.localStorage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    key: (i) => [...values.keys()][i],
    get length() {
      return values.size;
    },
  };
  const dialog = document.querySelector("#modal");
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new Event("close"));
  };
  return document;
}
const requests = [];
globalThis.fetch = async (url, options) => {
  requests.push(url);
  if (url === "/api/window-settings")
    return { ok: true, json: async () => ({}) };
  assert.ok(url.startsWith("/data/"));
  return {
    ok: true,
    json: async () =>
      JSON.parse(
        await fs.readFile(new URL("../public" + url, import.meta.url), "utf8"),
      ),
  };
};
test("English game data loads from local files and switching languages keeps both caches independent", async () => {
  dom();
  setLanguage("en", { persist: false });
  await init();
  assert.equal(t("Скоро"),"Coming soon");
  assert.equal(t("35 мин"),"35 min");
  assert.equal(t("Ragman · 1 точка"),"Ragman · 1 point");
  assert.equal(t("Ragman · 21 точка"),"Ragman · 21 points");
  assert.equal(t("карт"),"maps");
  assert.equal(t("предметов"),"items");
  assert.equal(t("заданий"),"quests");
  assert.equal(t("Язык применяется к интерфейсу, предметам, заданиям и справочнику."),"Language applies to the interface, items, quests and reference content.");
  assert.equal(db.items.length, 5480);
  assert.equal(db.quests.length, 570);
  assert.equal(
    db.maps.find((m) => m.normalizedName === "customs").name,
    "Customs",
  );
  const quest = await json("quests/debut.json");
  assert.equal(quest.quest.name, "Debut");
  const englishItem = await json("items/salewa-first-aid-kit.json");
  assert.match(englishItem.item.description, /first aid|medical/i);
  setLanguage("ru", { persist: false });
  const ru = await json("quests/debut.json");
  assert.equal(ru.quest.name, "Проба пера");
  assert.equal(quest.quest.name, "Debut");
  assert.ok(requests.every((url) => !url.startsWith("http")));
});
test("first-run tour completes all steps, persists dismissal and replays from Help without closing itself", async () => {
  const document = dom();
  setLanguage("en", { persist: false });
  installLocalization();
  assert.equal(hasSeenTour(), false);
  openTour();
  for (let step = 1; step <= 6; step++) {
    assert.match(
      document.querySelector(".tour-header").textContent,
      new RegExp(step + " / 6"),
    );
    assert.ok(document.querySelector("#modal").open);
    document.querySelector("[data-tour-next]").onclick();
  }
  assert.equal(hasSeenTour(), true);
  assert.equal(
    validWindowSettings({
      version: 1,
      values: {
        "tarkov-onboarding-v1": localStorage.getItem("tarkov-onboarding-v1"),
      },
    }),
    true,
  );
  openHelp();
  document.querySelector('[data-help-action="tour"]').onclick();
  assert.equal(document.querySelector("#modal").open, true);
  assert.match(document.querySelector("h2").textContent, /Welcome/);
  document.querySelector("[data-tour-skip]").onclick();
  openHelp();
  assert.equal(
    document
      .querySelector('[data-help-action="discord"]')
      .hasAttribute("disabled"),
    true,
  );
  assert.equal(
    document
      .querySelector('[data-help-action="support"]')
      .hasAttribute("disabled"),
    false,
  );
  document.querySelector('[data-help-action="support"]').onclick();
  assert.match(document.querySelector('#support-title').textContent,/Support/);
});
