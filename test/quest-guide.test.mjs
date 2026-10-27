import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../public/core/data.js";
import {
  renderGuide,
  guideAvailable,
  questImages,
} from "../public/features/quest-guide.js";
import {
  normalizeQuestSearch,
  matchesQuestSearch,
} from "../public/core/quest-search.js";
test("CMS quest walkthrough preserves formatted instructions, slider captions and map point links", () => {
  db.mode = "regular";
  db.assets["/api/media/file/example"] = "/assets/example.png";
  const q = {
    guideCms: {
      root: {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Найти рацию", format: 1 }],
          },
          {
            type: "block",
            fields: {
              blockType: "slider",
              slider: [
                {
                  image: { url: "/api/media/file/example", alt: "Рация" },
                  caption: "Под вышкой",
                },
              ],
            },
          },
          {
            type: "link",
            children: [{ type: "text", text: "На карте" }],
            fields: {
              doc: {
                relationTo: "mapPoints",
                value: {
                  map: { normalizedName: "shoreline" },
                  routeSlug: "tower-38",
                },
              },
            },
          },
        ],
      },
    },
  };
  const html = renderGuide(q.guideCms);
  assert.equal(guideAvailable(q), true);
  assert.match(html, /<strong>Найти рацию<\/strong>/);
  assert.match(html, /Под вышкой/);
  assert.match(html, /data-quest-image="\/assets\/example.png"/);
  assert.match(html, /#\/map\/regular\/shoreline\?q=tower-38/);
  assert.equal(questImages(q).length, 1);
});
test("classic walkthrough renders ordered steps, table cells and local image previews without executable links", () => {
  const html = renderGuide([
    {
      type: "list",
      ordered: true,
      items: [[{ type: "text", content: "Шаг 1" }]],
    },
    {
      type: "table",
      rows: [
        {
          type: "tableRow",
          cells: [
            { type: "tableCell", isHeader: true, colSpan: 2, content: "Ключи" },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", content: "<script>bad</script>" },
        {
          type: "link",
          href: "javascript:alert(1)",
          content: "Безопасный текст",
        },
      ],
    },
  ]);
  assert.match(html, /<ol><li>Шаг 1<\/li><\/ol>/);
  assert.match(html, /<th colspan="2">Ключи<\/th>/);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("javascript:"));
  assert.match(html, /Безопасный текст/);
});
test("quest search finds objective and guide words, handles ё, punctuation and multiple terms", () => {
  const text = normalizeQuestSearch(
    "Проверка на вшивость — Найти бронзовые часы. Ключ в жёлтой куртке.",
  );
  assert.equal(matchesQuestSearch(text, "ЧАСЫ ключ"), true);
  assert.equal(matchesQuestSearch(text, "желтой"), true);
  assert.equal(matchesQuestSearch(text, "часы лаборатория"), false);
  assert.equal(
    matchesQuestSearch(normalizeQuestSearch("Выполнить операцию"), "рацию"),
    false,
  );
});
