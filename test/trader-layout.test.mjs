import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseHTML } from "linkedom";
import { db } from "../public/core/data.js";
import { renderArticle } from "../public/features/articles.js";

test("trader information and explicit unlock quest precede the only assortment, which opens at loyalty 1", async () => {
  const { document, window } = parseHTML(
    "<html><body><main></main></body></html>",
  );
  const saved = {
      document: globalThis.document,
      window: globalThis.window,
      fetch: globalThis.fetch,
    },
    previous = { ...db };
  Object.assign(globalThis, { document, window });
  globalThis.fetch = async (url) =>
    Response.json(JSON.parse(await fs.readFile("public" + url, "utf8")));
  try {
    db.mode = "regular";
    db.lookup = JSON.parse(
      await fs.readFile("public/data/lookup.json", "utf8"),
    );
    db.assets = JSON.parse(
      await fs.readFile("public/data/assets.json", "utf8"),
    );
    db.items = JSON.parse(
      await fs.readFile("public/data/regular/items.json", "utf8"),
    );
    db.quests = JSON.parse(
      await fs.readFile("public/data/regular/quests.json", "utf8"),
    );
    const root = document.querySelector("main");
    await renderArticle(root, "trader/regular/jaeger");
    const headings = [...root.querySelectorAll("h2,h3")].map(
      (x) => x.textContent,
    );
    assert.ok(headings.indexOf("О торговце") < headings.indexOf("Ассортимент"));
    assert.ok(headings.includes("Как открыть и ключевые задания"));
    assert.equal(root.querySelectorAll("iframe").length, 0);
    assert.equal(
      root.querySelector("#trader-level option[selected]").value,
      "1",
    );
    assert.ok(root.querySelector('a[href="#/quest/regular/introduction"]'));
    const source = JSON.parse(
      await fs.readFile("public/data/traders/jaeger.json", "utf8"),
    );
    const expected = source.items.filter(
      (x) =>
        x.moneyOffers?.some((o) => o.vendor.minTraderLevel === 1) ||
        x.barters?.some((o) => o.level === 1),
    ).length;
    assert.equal(
      root.querySelectorAll("#trader-items tbody tr").length,
      expected,
    );
    const index = JSON.parse(
      await fs.readFile("public/data/trader-access.json", "utf8"),
    );
    assert.ok(index.modes.regular.jaeger.access.includes("introduction"));
    assert.ok(index.modes.regular.therapist.story.includes("tour"));
  } finally {
    Object.assign(globalThis, saved);
    Object.assign(db, previous);
  }
});
