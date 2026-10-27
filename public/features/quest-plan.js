import { esc } from "../core/ui.js";
import { db } from "../core/data.js";
export function renderQuestPlan(q, mode) {
  const goals = Array.isArray(q.objectives) ? q.objectives : [];
  const maps = new Map(),
    keys = new Map();
  let foundInRaid = false;
  for (const goal of goals) {
    foundInRaid ||= goal.foundInRaid === true;
    for (const map of [
      ...(goal.maps || []),
      ...(goal.possibleLocations || []).map((x) => x.map),
    ])
      if (
        map?.normalizedName &&
        map.name &&
        db.maps.some((known) => known.normalizedName === map.normalizedName)
      )
        maps.set(map.normalizedName, map);
    for (const key of (goal.requiredKeys || []).flat()) {
      const item = key?.item || key;
      if (item?.name)
        keys.set(item.id || item.normalizedName || item.name, item);
    }
  }
  return `<div class="notice">В сохранённом источнике нет отдельного авторского прохождения. Ниже — краткий план по целям задания. Он не задаёт порядок выполнения и не заменяет отсутствующие пояснения автора.</div><h3>Краткий план</h3>${goals.length ? `<ol class="quest-brief-plan">${goals.map((goal) => `<li><strong>${esc(goal.description || "Цель без описания")}</strong>${goal.count ? ` <span class="badge">× ${esc(goal.count)}</span>` : ""}${goal.optional ? ' <span class="badge">Необязательно</span>' : ""}${goal.foundInRaid ? '<p class="muted small">Предмет должен иметь статус «Найдено в рейде».</p>' : ""}</li>`).join("")}</ol>` : '<p class="muted">Источник пока не указал цели. Условия получения и награды доступны в соседней вкладке.</p>'}${foundInRaid ? "<p>Перед сдачей проверьте статус «Найдено в рейде» у требуемых предметов.</p>" : ""}${keys.size ? `<h3>Ключи, указанные в целях</h3><div class="row wrap">${[...keys.values()].map((key) => (key.normalizedName ? `<a class="button" href="#/item/${mode}/${encodeURIComponent(key.normalizedName)}">${esc(key.name)}</a>` : `<span class="badge">${esc(key.name)}</span>`)).join("")}</div>` : ""}${maps.size ? `<h3>Карты задания</h3><div class="row wrap">${[...maps.values()].map((map) => `<a class="button" href="#/map/${mode}/${encodeURIComponent(map.normalizedName)}?quest=${encodeURIComponent(q.normalizedName)}">⌖ ${esc(map.name)}</a>`).join("")}</div><p class="muted small">Если в базе есть отдельные точки этого задания, карта выделит их.</p>` : ""}<p class="muted small">Отмечайте отдельные цели во вкладке «Цели». Завершение всего задания отмечается отдельно.</p>`;
}
