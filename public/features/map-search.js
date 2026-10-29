import { uiIcon } from "../core/icons.js";
import { db, asset, detail } from "../core/data.js";
import { esc, modal, img, rich } from "../core/ui.js";
import {
  normalizeQuestSearch,
  matchesQuestSearch,
} from "../core/quest-search.js";
import { markerIcon } from "../core/map-icons.js";
import { language } from "../core/localization.js";
const pointCount = (n) =>
  language() === "en"
    ? `${n} ${n === 1 ? "point" : "points"} on this map`
    : `${n} ${n % 10 === 1 && n % 100 !== 11 ? "точка" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "точки" : "точек"} на карте`;
const textOf = (value) =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map(textOf).join(" ")
      : value && typeof value === "object"
        ? textOf(value.text || value.content || value.children || "")
        : "";
export function buildMapSearchIndex({
  markers,
  metadata,
  quests,
  items,
  maps = [],
  articles = [],
  map,
}) {
  const rows = [];
  const add = (row) =>
    rows.push({ ...row, text: normalizeQuestSearch(row.text || row.name) });
  markers.forEach((m, index) =>
    add({
      id: "marker:" + index,
      type: "marker",
      name: m.title || m.name,
      subtitle: m.lootContainer?.name || m.key?.name || "",
      icon: markerIcon(m, map),
      index,
      text: [
        m.title,
        m.name,
        m.lootContainer?.name,
        m.key?.name,
        textOf(m.description),
        ...(m.items || []).map((i) => i.name),
      ].join(" "),
    }),
  );
  for (const q of quests) {
    const meta = metadata[q.normalizedName] || {};
    add({
      id: "quest:" + q.normalizedName,
      type: "quest",
      slug: q.normalizedName,
      name: q.name,
      subtitle: meta.trader || q.trader?.name || "",
      icon: asset(meta.icon || q.imageLink || q.trader?.imageLink),
      text: meta.text || q.name,
      count: markers.filter((m) => m.quest?.normalizedName === q.normalizedName)
        .length,
    });
  }
  for (const item of items)
    add({
      id: "item:" + item.normalizedName,
      type: "item",
      slug: item.normalizedName,
      itemId: item.id,
      name: item.name,
      subtitle: item.shortName || "",
      icon: asset(item.iconLink),
      text: [item.name, item.shortName, item.normalizedName].join(" "),
    });
  for (const m of maps)
    add({
      id: "map:" + m.normalizedName,
      type: "map",
      name: m.name,
      subtitle: "",
      icon: asset(m.preview || m.imageThumb),
      href: "#/map/" + db.mode + "/" + m.normalizedName,
    });
  for (const a of articles)
    if (a.type !== "news")
      add({
        id: "article:" + a.path,
        type: "article",
        name: a.title,
        subtitle: "",
        icon: asset(a.image),
        href: "#/" + a.path,
      });
  return rows;
}
export function matchingMapMarkers(markers, rows, query, selections) {
  if (!query.trim() && !selections.length) return null;
  const candidates = selections.length
    ? selections
    : rows.filter((row) => matchesQuestSearch(row.text, query));
  const ids = new Set();
  for (const row of candidates)
    markers.forEach((m, index) => {
      if (
        (row.type === "marker" && row.index === index) ||
        (row.type === "quest" && m.quest?.normalizedName === row.slug) ||
        (row.type === "item" &&
          (m.key?.id === row.itemId ||
            m.key?.normalizedName === row.slug ||
            (m.items || []).some(
              (item) =>
                item.id === row.itemId || item.normalizedName === row.slug,
            )))
      )
        ids.add(index);
    });
  return ids;
}
export function createUnifiedMapSearch(
  container,
  { markers, metadata, map, onChange, onMarker, onQuest, onFocus },
) {
  const rows = buildMapSearchIndex({
    markers,
    metadata,
    map,
    quests: db.quests,
    items: db.items,
    maps: db.maps,
    articles: db.articles,
  });
  const selected = new Map();
  let query = "";
  let activeIndex = -1,
    previewId = 0;
  container.innerHTML =
    '<div class="map-search-field"><span aria-hidden="true">⌕</span><input id="map-universal-search" type="search" autocomplete="off" aria-label="Общий поиск" placeholder="Задание, предмет, выход, контейнер…" aria-expanded="false" aria-controls="map-search-results"><kbd>Ctrl K</kbd><button type="button" data-clear-search aria-label="Очистить поиск">×</button></div><div class="map-search-chips"></div><div id="map-search-results" class="map-search-results" hidden></div>';
  container.querySelector("[data-clear-search]").innerHTML = uiIcon(
    "close",
    18,
  );
  container.querySelector(".map-search-field>span").innerHTML = uiIcon(
    "search",
    22,
  );
  const input = container.querySelector("input"),
    results = container.querySelector(".map-search-results"),
    chips = container.querySelector(".map-search-chips");
  const labels = () =>
    language() === "en"
      ? {
          marker: "Map markers",
          quest: "Quests",
          item: "Items",
          map: "Maps",
          article: "Reference",
        }
      : {
          marker: "Метки на карте",
          quest: "Задания",
          item: "Предметы",
          map: "Карты",
          article: "Справочник",
        };
  function notify() {
    onChange({
      query,
      indices: matchingMapMarkers(markers, rows, query, [...selected.values()]),
      selectedQuests: [...selected.values()]
        .filter((r) => r.type === "quest")
        .map((r) => r.slug),
    });
  }
  function drawChips() {
    chips.innerHTML = [...selected.values()]
      .map(
        (row) =>
          '<button type="button" data-remove-search="' +
          esc(row.id) +
          '">' +
          esc(row.name) +
          " " +
          uiIcon("close", 14) +
          "</button>",
      )
      .join("");
    chips.querySelectorAll("[data-remove-search]").forEach(
      (b) =>
        (b.onclick = () => {
          selected.delete(b.dataset.removeSearch);
          drawChips();
          notify();
          draw();
        }),
    );
  }
  function toggle(row) {
    selected.has(row.id) ? selected.delete(row.id) : selected.set(row.id, row);
    drawChips();
    notify();
    draw();
    const focus =
      row.type === "marker"
        ? markers[row.index]
        : row.type === "quest"
          ? markers.find((m) => m.quest?.normalizedName === row.slug)
          : null;
    if (focus) onFocus(focus);
  }
  async function openItem(row) {
    const request = ++previewId;
    modal('<div class="empty">Загрузка…</div>');
    try {
      const d = await detail("items", row.slug);
      if (request !== previewId || !document.querySelector("#modal").open)
        return;
      document.querySelector("#modal-content").innerHTML =
        '<div class="map-item-preview">' +
        img(d.imageLink || d.baseImageLink || d.iconLink, d.name) +
        '<div><span class="eyebrow">' +
        (language() === "en" ? "ITEM" : "ПРЕДМЕТ") +
        "</span><h2>" +
        esc(d.name) +
        '</h2><div class="description">' +
        rich(d.description) +
        '</div><a class="button" href="#/item/' +
        db.mode +
        "/" +
        row.slug +
        '">' +
        (language() === "en"
          ? "Full item details →"
          : "Полная карточка предмета →") +
        "</a></div></div>";
    } catch (e) {
      if (request !== previewId || !document.querySelector("#modal").open)
        return;
      document.querySelector("#modal-content").innerHTML =
        "<p>" + esc(e.message) + "</p>";
    }
  }
  function open(row) {
    if (row.type === "quest") onQuest(row.slug);
    else if (row.type === "marker") {
      onFocus(markers[row.index]);
      onMarker(markers[row.index], row.index);
    } else if (row.type === "item") void openItem(row);
  }
  function draw() {
    const matches = query.trim()
      ? rows.filter((r) => matchesQuestSearch(r.text, query))
      : [];
    const label = labels();
    let html = "";
    for (const type of ["quest", "marker", "item", "map", "article"]) {
      const group = matches.filter((r) => r.type === type);
      if (!group.length) continue;
      html +=
        "<section><h3>" +
        label[type] +
        " <small>" +
        group.length +
        "</small></h3>" +
        group
          .slice(0, type === "marker" ? 8 : 5)
          .map((row) => {
            const select = ["marker", "quest", "item"].includes(type);
            return (
              '<div class="map-search-result" data-search-id="' +
              esc(row.id) +
              '">' +
              (select
                ? '<button type="button" data-toggle-search="' +
                  esc(row.id) +
                  '" aria-pressed="' +
                  selected.has(row.id) +
                  '" aria-label="' +
                  esc(
                    (language() === "en"
                      ? "Show on map: "
                      : "Показать на карте: ") + row.name,
                  ) +
                  '">' +
                  uiIcon(selected.has(row.id) ? "check" : "plus", 18) +
                  "</button>"
                : "") +
              "<" +
              (row.href
                ? 'a href="' + esc(row.href) + '"'
                : 'button type="button" data-open-search="' +
                  esc(row.id) +
                  '"') +
              ' class="map-search-result-main"><img src="' +
              esc(row.icon) +
              '" alt=""><span>' +
              esc(row.name) +
              "<small>" +
              esc(row.subtitle) +
              (type === "quest" ? " · " + pointCount(row.count) : "") +
              "</small></span></" +
              (row.href ? "a" : "button") +
              "></div>"
            );
          })
          .join("") +
        "</section>";
    }
    results.innerHTML =
      html ||
      '<p class="map-search-empty">' +
        (language() === "en"
          ? "Nothing found. Try a different name."
          : "Ничего не найдено. Попробуйте другое название.") +
        "</p>";
    results.hidden = !query.trim();
    input.setAttribute("aria-expanded", String(!results.hidden));
    activeIndex = -1;
    results
      .querySelectorAll("[data-toggle-search]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            toggle(rows.find((r) => r.id === b.dataset.toggleSearch))),
      );
    results
      .querySelectorAll("[data-open-search]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            open(rows.find((r) => r.id === b.dataset.openSearch))),
      );
  }
  input.oninput = () => {
    query = input.value;
    draw();
    notify();
  };
  input.onfocus = () => {
    if (query.trim()) draw();
  };
  container.querySelector("[data-clear-search]").onclick = () => {
    query = "";
    input.value = "";
    selected.clear();
    drawChips();
    draw();
    notify();
    input.focus();
  };
  input.onkeydown = (e) => {
    if (e.key === "Escape") {
      results.hidden = true;
      input.setAttribute("aria-expanded", "false");
      e.stopPropagation();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const buttons = [...results.querySelectorAll(".map-search-result-main")];
      if (!buttons.length) return;
      e.preventDefault();
      activeIndex =
        (activeIndex + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
        buttons.length;
      buttons[activeIndex].focus();
    }
  };
  results.onkeydown = (e) => {
    const buttons = [...results.querySelectorAll(".map-search-result-main")];
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      results.hidden = true;
      input.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const index = buttons.indexOf(document.activeElement);
      buttons[
        (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
          buttons.length
      ]?.focus();
    }
  };
  const controller = new AbortController();
  document
    .querySelector("#modal")
    ?.addEventListener("close", () => previewId++, {
      signal: controller.signal,
    });
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!container.contains(e.target)) {
        results.hidden = true;
        input.setAttribute("aria-expanded", "false");
      }
    },
    { signal: controller.signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k" &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        input.focus();
        input.select();
      }
    },
    { capture: true, signal: controller.signal },
  );
  window.addEventListener("view-changing", () => controller.abort(), {
    once: true,
  });
  return {
    selectQuest(slug) {
      if (!slug) {
        selected.clear();
        drawChips();
        notify();
        return;
      }
      const row = rows.find((r) => r.id === "quest:" + slug);
      if (row) toggle(row);
    },
    hasSelection: () => selected.size > 0,
  };
}
