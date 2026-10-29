import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseHTML } from "linkedom";
import {
  startSecretBrand,
  stopSecretBrand,
  secretBrandText,
} from "../public/core/secret-brand.js";
test("Index Maps replaces only visible branding, handles later pages and restores the original document", async () => {
  const prior = {
    document: globalThis.document,
    window: globalThis.window,
    MutationObserver: globalThis.MutationObserver,
  };
  const { document, window } = parseHTML(
    '<html><head><title>T_S_U_Y_U EFT GPS 1.8.1</title><link rel="icon" href="/icons/app.ico"></head><body><header><a class="brand"><img id="logo" src="/icons/app-192.png" alt="EFT GPS"><strong>T_S_U_Y_U EFT GPS <span>1.8.1</span></strong></a></header><main id="app"><section class="home-hero"><h1>EFT <span>GPS</span></h1></section><p>EFT GPS: новости</p><textarea>EFT GPS</textarea></main><footer>EFT GPS · Карты</footer></body></html>',
  );
  globalThis.document = document;
  globalThis.window = window;
  globalThis.MutationObserver = window.MutationObserver;
  const commands = [];
  window.chrome = {
    webview: { postMessage: (command) => commands.push(command) },
  };
  try {
    startSecretBrand();
    assert.equal(document.title, "Индекс Карты · Тарков");
    assert.match(
      document.querySelector(".brand strong").textContent,
      /Индекс Карты/,
    );
    assert.equal(
      document.querySelector("#logo").getAttribute("src"),
      "/icons/index-maps.svg",
    );
    assert.equal(document.querySelector("textarea").textContent, "EFT GPS");
    assert.match(document.querySelector("footer").textContent, /Индекс Карты/);
    const page = document.createElement("p");
    page.textContent = "T_S_U_Y_U EFT GPS: помощь";
    document.querySelector("#app").append(page);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(page.textContent, /Индекс Карты: помощь/);
    stopSecretBrand();
    assert.equal(document.title, "T_S_U_Y_U EFT GPS 1.8.1");
    assert.equal(
      document.querySelector("#logo").getAttribute("src"),
      "/icons/app-192.png",
    );
    assert.match(document.querySelector(".home-hero h1").innerHTML, /EFT/);
    assert.equal(page.textContent, "T_S_U_Y_U EFT GPS: помощь");
    assert.deepEqual(commands, ["secret-brand-on", "secret-brand-off"]);
    assert.equal(
      secretBrandText("EFT GPS / T_S_U_Y_U EFT GPS"),
      "Индекс Карты / Индекс Карты",
    );
  } finally {
    stopSecretBrand();
    Object.assign(globalThis, prior);
  }
});
test("temporary native branding accepts only fixed local commands and ships its own local icon", async () => {
  const host = await fs.readFile("scripts/DesktopHost.cs", "utf8");
  assert.match(host, /if \(!IsLocal\(e.Source\)\) return/);
  assert.match(host, /command == "secret-brand-on"/);
  assert.match(host, /command == "secret-brand-off"/);
  const ico = await fs.readFile("public/icons/index-maps.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 1);
  const svg = await fs.readFile("public/icons/index-maps.svg", "utf8");
  assert.doesNotMatch(svg, /<script|https?:\/\/(?!www.w3.org)/);
});
