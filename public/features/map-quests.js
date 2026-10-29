import { uiIcon } from "../core/icons.js";
import { asset } from "../core/data.js";
import { esc } from "../core/ui.js";
import {
  normalizeQuestSearch,
  matchesQuestSearch,
} from "../core/quest-search.js";
export function createMapQuestPanel(
  container,
  { markers, metadata, onSelect, onOpen },
) {
  const quests = new Map();
  let selected = new Set(),
    query = "";
  for (const marker of markers) {
    const quest = marker.quest;
    if (!quest?.normalizedName) continue;
    const slug = quest.normalizedName;
    if (!quests.has(slug)) {
      const info = metadata[slug] || {};
      quests.set(slug, {
        slug,
        name: quest.name || info.name,
        icon: info.icon || quest.icon,
        count: 0,
        trader: info.trader || "",
        text: normalizeQuestSearch(info.text || quest.name),
      });
    }
    quests.get(slug).count++;
  }
  const entries = [...quests.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ru"),
  );
  container.innerHTML = `<details class="map-quest-browser" open><summary>Задания на карте <small>${entries.length}</small></summary><div class="map-quest-selection"></div><div class="map-quest-results"></div></details>`;
  const results = container.querySelector(".map-quest-results"),
    selection = container.querySelector(".map-quest-selection");
  function draw() {
    const matches = entries.filter((quest) =>
      matchesQuestSearch(quest.text, query),
    );
    results.innerHTML =
      matches
        .slice(0, 100)
        .map(
          (quest) =>
            `<div class="map-quest-row"><button type="button" data-select-map-quest="${esc(quest.slug)}" aria-pressed="${selected.has(quest.slug)}"><img src="${asset(quest.icon)}" alt=""><span>${esc(quest.name)}<small>${esc(quest.trader)} · ${quest.count} ${quest.count % 10 === 1 && quest.count % 100 !== 11 ? "точка" : [2, 3, 4].includes(quest.count % 10) && ![12, 13, 14].includes(quest.count % 100) ? "точки" : "точек"}</small></span></button><button type="button" data-preview-map-quest="${esc(quest.slug)}" aria-label="Прохождение: ${esc(quest.name)}" title="Как выполнить">${uiIcon("info", 20)}</button></div>`,
        )
        .join("") +
      (matches.length > 100
        ? `<p class="small muted">Ещё ${matches.length - 100}. Уточните поиск.</p>`
        : "") +
      (!matches.length ? '<p class="small muted">Заданий не найдено.</p>' : "");
    selection.innerHTML = selected.size
      ? `<p class="small">Выбрано: ${selected.size}</p><button type="button" class="quiet" data-clear-map-quest>Показать все задания</button>`
      : "";
    results
      .querySelectorAll("[data-select-map-quest]")
      .forEach(
        (button) =>
          (button.onclick = () => onSelect(button.dataset.selectMapQuest)),
      );
    results
      .querySelectorAll("[data-preview-map-quest]")
      .forEach(
        (button) =>
          (button.onclick = () => onOpen(button.dataset.previewMapQuest)),
      );
    selection
      .querySelector("[data-clear-map-quest]")
      ?.addEventListener("click", () => onSelect(""));
  }
  draw();
  return {
    setQuery(value) {
      query = value;
      draw();
    },
    setSelected(slug) {
      selected = new Set(Array.isArray(slug) ? slug : slug ? [slug] : []);
      draw();
    },
  };
}
