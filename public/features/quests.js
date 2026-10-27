import { db, detail } from "../core/data.js";
import { current, toggleQuest, toggleObjective } from "../core/state.js";
import { esc, img, heading, pagination, bindPages, rich } from "../core/ui.js";
export function renderQuests(root) {
  root.innerHTML =
    heading(
      "Квесты",
      `${db.quests.length} заданий · прогресс хранится отдельно для PvP и PvE`,
    ) +
    `<div class="toolbar"><input type="search" id="quest-search" placeholder="Искать задание"><select id="quest-trader" aria-label="Торговец"><option value="">Все торговцы</option>${Object.entries(
      db.lookup.traders || {},
    )
      .map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`)
      .join(
        "",
      )}</select><select id="quest-kind" aria-label="Тип заданий"><option value="">Все задания</option><option value="kappa">Каппа</option><option value="lightkeeper">Смотритель</option><option value="story">Сюжетные</option><option value="season">Сезонные</option></select><label class="check"><input id="quest-hide" type="checkbox"> Скрыть завершённые</label></div><div id="quest-results"></div>`;
  let page = 0;
  const draw = () => {
    const q = root.querySelector("#quest-search").value.toLowerCase(),
      t = root.querySelector("#quest-trader").value,
      k = root.querySelector("#quest-kind").value,
      hide = root.querySelector("#quest-hide").checked;
    const rows = db.quests.filter(
      (x) =>
        x.name.toLowerCase().includes(q) &&
        (!t ||
          (typeof x.trader === "string"
            ? x.trader
            : x.trader?.normalizedName) === t) &&
        (!hide || !current().quests[x.normalizedName]) &&
        (!k ||
          (k === "kappa"
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
          `<tr class="${current().quests[x.normalizedName] ? "done" : ""}"><td><input type="checkbox" aria-label="Завершено: ${esc(x.name)}" data-quest="${x.normalizedName}" ${current().quests[x.normalizedName] ? "checked" : ""}></td><td><a class="item-name" href="#/quest/${db.mode}/${x.normalizedName}">${img(x.iconLink || db.lookup.traders?.[x.trader]?.imageLink || x.trader?.imageLink, x.name)}${esc(x.name)}</a></td><td>${esc(db.lookup.traders?.[x.trader]?.name || x.trader?.name || "Сюжетное")}</td><td>${x.minPlayerLevel}</td><td>${x.kappaRequired ? '<span class="badge">Каппа</span>' : ""} ${x.lightkeeperRequired ? '<span class="badge">Смотритель</span>' : ""}</td></tr>`,
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
  root.innerHTML =
    heading(
      q.name,
      `${q.trader?.name || "Сюжетное задание"} · уровень ${q.minPlayerLevel} · ${q.experience || 0} опыта`,
      `<button id="quest-toggle" class="primary">${current().quests[slug] ? "✓ Завершено" : "Отметить выполненным"}</button>`,
    ) +
    `<div class="detail-grid"><aside class="panel">${img(q.taskImageLink, q.name, "quest-picture")}<h3>Требования</h3>${(q.taskRequirements || []).map((x) => `<p><a href="#/quest/${db.mode}/${x.task?.normalizedName || x.normalizedName}">${esc(x.task?.name || x.name)}</a></p>`).join("") || '<p class="muted">Нет предыдущих заданий</p>'}<h3>Награда</h3><p>${q.experience || 0} опыта</p>${(q.finishRewards?.money || []).map((x) => `<p>${esc(x)}</p>`).join("")}${(q.finishRewards?.items || []).map((x) => `<p><a href="#/item/${db.mode}/${x.item?.normalizedName}">${esc(x.item?.name || x.item?.shortName)} × ${x.count}</a></p>`).join("")}${(q.finishRewards?.traderStanding || []).map((x) => `<p>${esc(x.trader?.name)}: +${x.standing}</p>`).join("")}</aside><section><h2>Цели</h2><div class="objectives">${(q.objectives || []).map((x, i) => `<label class="objective"><input type="checkbox" data-objective="${x.id || slug + "-" + i}" ${current().objectives[x.id || slug + "-" + i] ? "checked" : ""}><span>${esc(x.description)} ${x.count ? `<b>× ${x.count}</b>` : ""}<small class="block muted">${(x.maps || []).map((m) => esc(m.name)).join(" · ")}${x.foundInRaid ? " · Найти в рейде" : ""}${x.optional ? " · Необязательно" : ""}</small>${x.item ? `<a href="#/item/${db.mode}/${x.item.normalizedName}">${esc(x.item.name)}</a>` : ""}</span></label>`).join("")}</div><h2>Прохождение</h2><article class="guide">${rich(q.guide) || '<p class="muted">Для этого задания руководство не добавлено.</p>'}</article><h2>Следующие задания</h2><div class="row wrap">${(q.nextQuests || []).map((x) => `<a class="button" href="#/quest/${db.mode}/${x.normalizedName}">${esc(x.name)}</a>`).join("") || '<span class="muted">Цепочка завершена</span>'}</div></section></div>`;
  root.querySelector("#quest-toggle").onclick = () => {
    toggleQuest(slug);
    renderQuest(root, slug);
  };
  root
    .querySelectorAll("[data-objective]")
    .forEach((e) => (e.onchange = () => toggleObjective(e.dataset.objective)));
}
