import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  data = path.join(root, "public/data");
const read = (f) => JSON.parse(fs.readFileSync(path.join(data, f)));
test("both modes include a local detail record for every catalog item and quest", () => {
  for (const mode of ["regular", "pve"])
    for (const kind of ["items", "quests"]) {
      const list = read(mode + "/" + kind + ".json");
      assert.ok(list.length > 500, mode + " " + kind + " is incomplete");
      for (const x of list) {
        if (kind === "items")
          assert.ok(x.id, "Missing stable item ID: " + x.normalizedName);
        const prefix = mode === "regular" ? "" : mode + "/";
        const value = read(prefix + kind + "/" + x.normalizedName + ".json");
        assert.ok(
          value[kind === "items" ? "item" : "quest"],
          mode + " " + x.normalizedName,
        );
      }
    }
});
test("every map floor has an existing local drawing and asset index files exist", () => {
  const assets = read("assets.json");
  for (const file of Object.values(assets))
    assert.ok(fs.existsSync(path.join(root, "public", file)), file);
  for (const mode of ["regular", "pve"])
    for (const entry of read("maps.json")) {
      const m = read(
        (mode === "regular" ? "" : mode + "/") +
          "maps/" +
          entry.normalizedName +
          ".json",
      ).map;
      for (const layer of [m, ...(m.layers || [])]) {
        const drawing = layer.renderedPath || assets[layer.svgPath];
        if (!layer.svgPath && !layer.tilePath) continue;
        assert.ok(
          drawing,
          "Missing floor " + entry.normalizedName + " " + layer.name,
        );
        assert.ok(fs.existsSync(path.join(root, "public", drawing)), drawing);
      }
    }
});
test("archived articles contain their streamed body, not a loading placeholder", () => {
  const articles = read("articles.json");
  assert.ok(articles.length >= 82);
  for (const a of articles) {
    const d = read("articles/" + a.path.replaceAll("/", "__") + ".json");
    assert.ok(d.html.length > 200, a.path);
    assert.ok(
      !d.html.includes('<template id="B:'),
      "Unresolved streamed content " + a.path,
    );
  }
});
