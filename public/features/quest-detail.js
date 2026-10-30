import { db, json, asset } from "../core/data.js";
import { current, toggleQuest, toggleObjective } from "../core/state.js";
import { esc, img, modal } from "../core/ui.js";
import {
  renderGuide,
  guideAvailable,
  questImages,
  guideImage,
  bindGuideImages,
} from "./quest-guide.js";
import { renderQuestPlan } from "./quest-plan.js";
let previewVersion = 0,
  boundDialog = null;
const arr = (v) => (Array.isArray(v) ? v : []);
function itemCard(item, count = 1, mode = db.mode) {
  if (!item) return "";
  const known = item.normalizedName
    ? item
    : db.items.find((i) => i.id === item.id);
  const content = `${img(item.iconLink || item.baseImageLink || item.gridImageLink, item.name || known?.name || "Предмет")}<span>${esc(item.name || known?.name || "Предмет")}${count ? ` <b>× ${esc(count)}</b>` : ""}</span>`;
  return known?.normalizedName
    ? `<a class="quest-item" href="#/item/${mode}/${known.normalizedName}">${content}</a>`
    : `<div class="quest-item">${content}</div>`;
}
function rewards(value, mode) {
  if (!value) return '<p class="muted">В источнике не указаны.</p>';
  let html = arr(value.money)
    .map((v) => `<p class="quest-money">${esc(v)}</p>`)
    .join("");
  html += arr(value.items)
    .map((v) => itemCard(v.item || v, v.count, mode))
    .join("");
  html += arr(value.traderStanding)
    .map(
      (v) =>
        `<p>${esc(v.trader?.name)}: ${Number(v.standing) > 0 ? "+" : ""}${esc(v.standing)} репутации</p>`,
    )
    .join("");
  html += arr(value.skillLevelReward)
    .map(
      (v) =>
        `<p>${esc(v.skill?.name || v.name || "Навык")}: +${esc(v.level || v.value || v.count || 0)}</p>`,
    )
    .join("");
  html += arr(value.traderUnlock)
    .map((v) => `<p>Открывается торговец: ${esc(v.trader?.name || v.name)}</p>`)
    .join("");
  html += arr(value.offerUnlock)
    .map(
      (v) =>
        `<div class="quest-unlock"><p>Открывается покупка · ${esc(v.trader?.name || "")} ${v.level ? `ур. ${esc(v.level)}` : ""}</p>${itemCard(v.item, v.count || 1, mode)}</div>`,
    )
    .join("");
  html += arr(value.craftUnlock)
    .map(
      (v) =>
        `<div class="quest-unlock"><p>Открывается рецепт · ${esc(v.station?.name || "")} ${v.level ? `ур. ${esc(v.level)}` : ""}</p>${
          arr(v.rewardItems).length
            ? arr(v.rewardItems)
                .map((r) => itemCard(r.item, r.count || 1, mode))
                .join("")
            : itemCard(v.item || v.reward?.item, v.count || 1, mode)
        }</div>`,
    )
    .join("");
  return html || '<p class="muted">Дополнительные награды не указаны.</p>';
}
function objectives(q, mode) {
  return (
    arr(q.objectives)
      .map((objective, index) => {
        const id = objective.id || q.normalizedName + "-" + index;
        const items = [
          ...arr(objective.items),
          ...(objective.item ? [objective.item] : []),
          ...(objective.questItem ? [objective.questItem] : []),
        ];
        const keys = arr(objective.requiredKeys).flat();
        return `<section class="quest-objective"><label class="objective"><input type="checkbox" data-objective="${esc(id)}" ${current().objectives[id] ? "checked" : ""}><span>${esc(objective.description || "Цель задания")} ${objective.count ? `<b>× ${esc(objective.count)}</b>` : ""}<small class="block muted">${objective.optional ? "Необязательная цель · " : ""}${objective.foundInRaid ? "Найти в рейде · " : ""}${arr(
          objective.maps,
        )
          .map((m) => esc(m.name))
          .join(
            " · ",
          )}</small></span></label>${items.length ? `<div class="quest-items">${items.map((item) => itemCard(item, 0, mode)).join("")}</div>` : ""}${keys.length ? `<h4>Нужные ключи</h4><div class="quest-items">${keys.map((key) => itemCard(key, 0, mode)).join("")}</div>` : ""}<div class="row wrap">${arr(
          objective.possibleLocations,
        )
          .filter((location) =>
            db.maps.some(
              (map) => map.normalizedName === location.map?.normalizedName,
            ),
          )
          .map(
            (location) =>
              `<a class="button quest-map-link" href="#/map/${mode}/${location.map?.normalizedName}?quest=${encodeURIComponent(q.normalizedName)}">⌖ ${esc(location.map?.name)} · ${esc(location.name || "Показать точки")}</a>`,
          )
          .join("")}</div></section>`;
      })
      .join("") ||
    '<p class="muted">Отдельные цели не указаны. См. прохождение задания.</p>'
  );
}
export function renderQuestCard(
  root,
  q,
  { mode = db.mode, context = null, compact = false } = {},
) {
  const slug = q.normalizedName,
    images = questImages(q),
    guide = guideAvailable(q)
      ? renderGuide(q.guideCms?.root?.children?.length ? q.guideCms : q.guide)
      : renderQuestPlan(q, mode);
  root.innerHTML = `<div class="quest-card-view"><header class="quest-card-header">${img(q.iconLink || q.trader?.imageLink || q.taskImageLink, q.name, "quest-title-icon")}<div><span class="eyebrow">${esc(q.trader?.name || "Сюжетное задание")} · ${mode === "pve" ? "PVE" : "PVP"}</span><h${compact ? "2" : "1"}>${esc(q.name)}</h${compact ? "2" : "1"}><div class="row wrap"><span class="badge">Уровень ${q.minPlayerLevel || 0}</span><span class="badge">${q.experience || 0} опыта</span>${q.kappaRequired ? '<span class="badge">Каппа</span>' : ""}${q.lightkeeperRequired ? '<span class="badge">Смотритель</span>' : ""}${q.isEventQuest ? '<a class="badge event-badge" href="#/event/halloween-2026-6">Хэллоуин 2026 · временное задание</a>' : ""}${q.restartable ? '<span class="badge">Повторяемое</span>' : ""}</div></div><button class="primary" data-complete-quest>${current().quests[slug] ? "✓ Завершено" : "Отметить выполненным"}</button></header>${context?.marker ? `<div class="quest-context"><span class="eyebrow">Выбранная точка · ${esc(context.mapName || "Карта")}</span><strong>${esc(context.marker?.title || q.name)}</strong>${context.marker?.description ? `<div>${renderGuide(context.marker.description)}</div>` : ""}</div>` : ""}<div class="quest-tabs" role="tablist" aria-label="Разделы задания">${[
    ["guide", "Прохождение"],
    ["objectives", "Цели"],
    ["requirements", "Требования и награды"],
    ["images", `Иллюстрации (${images.length})`],
  ]
    .map(
      ([id, label], i) =>
        `<button type="button" role="tab" data-quest-tab="${id}" aria-selected="${i === 0}" aria-controls="quest-panel-${id}" id="quest-tab-${id}" tabindex="${i === 0 ? 0 : -1}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="quest-tab-body"><section role="tabpanel" id="quest-panel-guide" aria-labelledby="quest-tab-guide" class="quest-guide">${guide}</section><section role="tabpanel" id="quest-panel-objectives" aria-labelledby="quest-tab-objectives" hidden>${objectives(q, mode)}</section><section role="tabpanel" id="quest-panel-requirements" aria-labelledby="quest-tab-requirements" hidden><div class="quest-columns"><div><h3>Условия получения</h3><p>Уровень персонажа: ${q.minPlayerLevel || 0}</p>${arr(
    q.taskRequirements,
  )
    .map(
      (r) =>
        `<a class="button" href="#/quest/${mode}/${r.task?.normalizedName || r.normalizedName}">${esc(r.task?.name || r.name || "Предыдущее задание")}</a>`,
    )
    .join("")}${arr(q.traderRequirements)
    .map(
      (r) =>
        `<p>${esc(r.trader?.name || "Торговец")} · ${r.requirementType === "standing" ? "репутация" : "уровень"} ${esc(r.compareMethod || "≥")} ${esc(r.value ?? r.level ?? r.loyaltyLevel ?? 0)}</p>`,
    )
    .join(
      "",
    )}<h3>Выдаётся в начале</h3>${rewards(q.startRewards, mode)}${q.failureOutcome ? `<h3>Последствия провала</h3>${rewards(q.failureOutcome, mode)}` : ""}</div><div><h3>Награды за выполнение</h3><p>${q.experience || 0} опыта</p>${rewards(q.finishRewards, mode)}</div></div><h3>Следующие задания</h3><div class="row wrap">${
    arr(q.nextQuests)
      .map(
        (next) =>
          `<a class="button" href="#/quest/${mode}/${next.normalizedName}">${esc(next.name)}</a>`,
      )
      .join("") || '<span class="muted">В источнике не указаны.</span>'
  }</div></section><section role="tabpanel" id="quest-panel-images" aria-labelledby="quest-tab-images" hidden><div class="quest-gallery">${images.map((image) => `<figure>${guideImage(image)}</figure>`).join("") || '<p class="muted">Для этого задания источник не добавил иллюстраций.</p>'}</div></section></div>${compact ? `<a class="button quest-full-link" href="#/quest/${mode}/${slug}">Открыть полную страницу задания →</a>` : ""}</div>`;
  const tabs = [...root.querySelectorAll("[data-quest-tab]")];
  function activate(tab) {
    for (const button of tabs) {
      const selected = button === tab;
      button.setAttribute("aria-selected", selected);
      button.tabIndex = selected ? 0 : -1;
      root.querySelector("#quest-panel-" + button.dataset.questTab).hidden =
        !selected;
    }
    root.querySelector(".quest-tab-body").scrollTop = 0;
  }
  tabs.forEach((tab, index) => {
    tab.onclick = () => activate(tab);
    tab.onkeydown = (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft")
        next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next]);
      tabs[next].focus();
    };
  });
  root.querySelector("[data-complete-quest]").onclick = (event) => {
    toggleQuest(slug);
    event.currentTarget.textContent = current().quests[slug]
      ? "✓ Завершено"
      : "Отметить выполненным";
  };
  root
    .querySelectorAll("[data-objective]")
    .forEach(
      (input) =>
        (input.onchange = () => toggleObjective(input.dataset.objective)),
    );
  bindGuideImages(root);
}
export async function openQuestPreview(slug, context = null) {
  const version = ++previewVersion,
    mode = db.mode,
    dialog = document.querySelector("#modal");
  if (boundDialog !== dialog) {
    dialog.addEventListener("close", () => {
      previewVersion++;
      dialog.classList.remove("quest-dialog");
    });
    boundDialog = dialog;
  }
  dialog.classList.add("quest-dialog");
  modal('<div class="empty" role="status">Загрузка прохождения…</div>');
  try {
    const { quest } = await json(
      (mode === "pve" ? "pve/" : "") + "quests/" + slug + ".json",
    );
    if (version !== previewVersion || !dialog.open) return;
    renderQuestCard(document.querySelector("#modal-content"), quest, {
      mode,
      context,
      compact: true,
    });
  } catch (error) {
    if (version === previewVersion && dialog.open)
      document.querySelector("#modal-content").innerHTML =
        `<div class="notice">${esc(error.message)}</div>`;
  }
}
