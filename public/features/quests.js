import { db, detail, json } from "../core/data.js";
import { renderQuestCard } from "./quest-detail.js";
import {
  normalizeQuestSearch,
  matchesQuestSearch,
} from "../core/quest-search.js";
import { current, toggleQuest } from "../core/state.js";
import { esc, img, heading, pagination, bindPages } from "../core/ui.js";
export async function renderQuests(root) {
  const metadata = await json(db.mode + "/quest-search.json").catch(() => ({}));
  const searchTexts = new Map(
    db.quests.map((q) => [
      q.normalizedName,
      normalizeQuestSearch(metadata[q.normalizedName]?.text || q.name),
    ]),
  );
  root.innerHTML =
    heading(
      "Задания",
      `${db.quests.length} заданий · прогресс хранится отдельно для PvP и PvE`,
    ) +
    `<div class="toolbar"><input type="search" id="quest-search" placeholder="Название, цель, предмет или текст прохождения"><select id="quest-trader" aria-label="Торговец"><option value="">Все торговцы</option>${Object.entries(
      db.lookup.traders || {},
    )
      .map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`)
      .join(
        "",
      )}</select><select id="quest-kind" aria-label="Тип заданий"><option value="">Все задания</option><option value="halloween">Хэллоуин 2026 · временные</option><option value="kappa">Каппа</option><option value="lightkeeper">Смотритель маяка</option><option value="story">Сюжетные</option><option value="season">Сезонные</option></select><label class="check"><input id="quest-hide" type="checkbox"> Скрыть завершённые</label></div><div id="quest-results"></div>`;
  let page = 0;
  const draw = () => {
    const q = root.querySelector("#quest-search").value.toLowerCase(),
      t = root.querySelector("#quest-trader").value,
      k = root.querySelector("#quest-kind").value,
      hide = root.querySelector("#quest-hide").checked;
    const rows = db.quests.filter(
      (x) =>
        matchesQuestSearch(searchTexts.get(x.normalizedName), q) &&
        (!t ||
          (metadata[x.normalizedName]?.traderSlug ||
            (typeof x.trader === "string"
              ? x.trader
              : x.trader?.normalizedName)) === t) &&
        (!hide || !current().quests[x.normalizedName]) &&
        (!k ||
          (k === "halloween"
            ? x.eventSlug === "halloween-2026"
            : k === "kappa"
              ? x.kappaRequired
              : k === "lightkeeper"
                ? x.lightkeeperRequired
                : k === "season"
                  ? x.isSeasonalQuest
                  : x.type === "main" || x.type === "story")),
    );
    const box = root.querySelector("#quest-results");
    box.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Готово</th><th>Название</th><th>Торговец</th><th>Уровень</th><th>Требования</th></tr></thead><tbody>${rows
      .slice(page * 50, page * 50 + 50)
      .map(
        (x) =>
          `<tr class="${current().quests[x.normalizedName] ? "done" : ""}"><td><input type="checkbox" aria-label="Завершено: ${esc(x.name)}" data-quest="${x.normalizedName}" ${current().quests[x.normalizedName] ? "checked" : ""}></td><td><a class="item-name" href="#/quest/${db.mode}/${x.normalizedName}">${img(x.iconLink || metadata[x.normalizedName]?.icon || db.lookup.traders?.[x.trader]?.imageLink || x.trader?.imageLink, x.name)}${esc(x.name)}</a></td><td>${esc(db.lookup.traders?.[x.trader]?.name || x.trader?.name || "Сюжетное")}</td><td>${x.minPlayerLevel}</td><td>${x.isEventQuest ? '<span class="badge event-badge">Хэллоуин 2026</span>' : ""}${x.kappaRequired ? '<span class="badge">Каппа</span>' : ""} ${x.lightkeeperRequired ? '<span class="badge">Смотритель</span>' : ""}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div>${rows.length ? "" : '<div class="empty">Заданий по этим фильтрам нет.</div>'}${pagination(rows.length, page, 50)}`;
    box.querySelectorAll("[data-quest]").forEach(
      (e) =>
        (e.onchange = () => {
          toggleQuest(e.dataset.quest);
          draw();
        }),
    );
    bindPages(box, (p) => {
      page = p;
      draw();
    });
  };
  root.querySelectorAll("input,select").forEach((e) =>
    e.addEventListener(e.type === "search" ? "input" : "change", () => {
      page = 0;
      draw();
    }),
  );
  draw();
}
export async function renderQuest(root, slug) {
  const q = await detail("quests", slug);
  renderQuestCard(root, q);
}
