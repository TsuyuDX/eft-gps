import { bindDesktopActions } from "../core/desktop-bridge.js";
import { confirmAction } from "../core/ui.js";
import { renderPreferences } from "../core/preferences.js";
import { db, json } from "../core/data.js";
import {
  current,
  inventory,
  setHideout,
  save,
  exportProfile,
  replaceState,
  profile,
} from "../core/state.js";
import { requirements, modifierResult } from "../core/domain.js";
import {
  heading,
  esc,
  img,
  pagination,
  bindPages,
  toast,
  money,
} from "../core/ui.js";
export function renderTracker(root) {
  root.innerHTML =
    heading(
      "Трекер предметов",
      "Список учитывает завершённые задания и построенные уровни убежища",
      `<button id="export-progress">↓ Резервная копия</button>`,
    ) +
    `<div class="toolbar"><input type="search" id="tracker-search" placeholder="Найти предмет"><select id="tracker-scope" aria-label="Для чего нужны предметы"><option value="all">Задания и убежище</option><option value="quests">Только задания</option><option value="hideout">Только убежище</option></select><label class="check"><input type="checkbox" id="tracker-hide" checked> Скрыть собранные</label><label class="check"><input type="checkbox" id="tracker-fir"> Найти в рейде</label></div><div id="tracker-results"></div>`;
  let page = 0;
  function draw() {
    const q = root.querySelector("#tracker-search").value.toLowerCase(),
      scope = root.querySelector("#tracker-scope").value,
      hide = root.querySelector("#tracker-hide").checked,
      fir = root.querySelector("#tracker-fir").checked;
    const rows = Object.entries(db.tracker.fullItemsDataMap || {})
      .map(([id, e]) => ({
        id,
        item: db.tracker.itemsData[id],
        ...requirements(e, current(), scope),
      }))
      .filter(
        (x) =>
          x.item &&
          x.count > 0 &&
          x.item.name.toLowerCase().includes(q) &&
          (!hide || (current().inventory[x.id] || 0) < x.count) &&
          (!fir || x.fir),
      );
    const box = root.querySelector("#tracker-results");
    box.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Предмет</th><th>Для чего</th><th>Нужно</th><th>Собрано</th><th>Осталось</th></tr></thead><tbody>${rows
      .slice(page * 40, page * 40 + 40)
      .map((x) => {
        const have = current().inventory[x.id] || 0;
        return `<tr class="${have >= x.count ? "done" : ""}"><td><a class="item-name" href="#/item/${db.mode}/${x.item.normalizedName}">${img(x.item.iconLink, x.item.name)}<span>${esc(x.item.name)}${x.fir ? '<small class="block accent">Найти в рейде</small>' : ""}</span></a></td><td><details><summary>${x.reasons.length} требований</summary>${x.reasons.map((r) => `<p class="small"><a href="#/${r.kind === "quest" ? "quest" : "hideout"}/${db.mode}/${r.info?.normalizedName}">${esc(r.kind === "quest" ? db.quests.find((q) => q.normalizedName === r.info?.normalizedName)?.name || r.info?.normalizedName : db.lookup.hideout?.[r.info?.normalizedName]?.name)}${r.info?.level ? " · ур. " + r.info.level : ""}</a> × ${r.count}</p>`).join("")}</details></td><td>${x.count.toLocaleString("ru-RU")}</td><td><div class="counter"><button data-delta="-1" data-id="${x.id}" aria-label="Уменьшить">−</button><input type="number" min="0" data-count="${x.id}" aria-label="Собрано ${esc(x.item.shortName)}" value="${have}"><button data-delta="1" data-id="${x.id}" aria-label="Увеличить">＋</button></div></td><td>${Math.max(0, x.count - have).toLocaleString("ru-RU")}</td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div>${rows.length ? "" : '<div class="empty">По выбранным условиям предметов нет.</div>'}${pagination(rows.length, page, 40)}`;
    box.querySelectorAll("[data-count]").forEach(
      (e) =>
        (e.onchange = () => {
          inventory(e.dataset.count, e.value);
          draw();
        }),
    );
    box.querySelectorAll("[data-delta]").forEach(
      (e) =>
        (e.onclick = () => {
          inventory(
            e.dataset.id,
            (current().inventory[e.dataset.id] || 0) + Number(e.dataset.delta),
          );
          draw();
        }),
    );
    bindPages(box, (p) => {
      page = p;
      draw();
    });
  }
  root.querySelectorAll("input,select").forEach((e) =>
    e.addEventListener(e.type === "search" ? "input" : "change", () => {
      page = 0;
      draw();
    }),
  );
  root.querySelector("#export-progress").onclick = exportProfile;
  draw();
}
export function renderHideout(root) {
  const stations = Object.values(db.lookup.hideout || {});
  const maxLevel = (slug) =>
    Math.max(
      1,
      ...Object.values(db.tracker.fullItemsDataMap || {})
        .flatMap((e) => Object.values(e.hideoutData || {}))
        .filter((x) => x.normalizedName === slug)
        .map((x) => x.level),
    );
  root.innerHTML =
    heading(
      "Убежище",
      "Улучшения, требования и производство · отметьте построенные уровни",
    ) +
    `<div class="card-grid hideout-grid">${stations.map((x) => `<section class="card"><a class="station-heading" href="#/hideout/${db.mode}/${x.normalizedName}">${img(x.imageLink, x.name)}<h2>${esc(x.name)}</h2></a><div class="card-body"><label>Построено <select data-station="${x.normalizedName}" aria-label="Уровень ${esc(x.name)}">${Array.from({ length: maxLevel(x.normalizedName) + 1 }, (_, i) => `<option value="${i}" ${current().hideout[x.normalizedName] === i ? "selected" : ""}>${i === 0 ? "Не построено" : "Уровень " + i}</option>`).join("")}</select></label><a class="block small" href="#/hideout/${db.mode}/${x.normalizedName}">Требования и рецепты →</a></div></section>`).join("")}</div>`;
  root.querySelectorAll("[data-station]").forEach(
    (e) =>
      (e.onchange = () => {
        setHideout(e.dataset.station, e.value);
        toast("Уровень убежища сохранён");
      }),
  );
}
export function hideoutRequirements(slug) {
  const levels = new Map();
  for (const [id, e] of Object.entries(db.tracker.fullItemsDataMap || {}))
    for (const [key, info] of Object.entries(e.hideoutData || {}))
      if (info.normalizedName === slug) {
        const level = info.level;
        levels.set(level, [
          ...(levels.get(level) || []),
          {
            item: db.tracker.itemsData[id],
            count: e.hideoutExtraData?.[key]?.totalCount || 0,
          },
        ]);
      }
  return [...levels.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([level, rows]) =>
        `<section class="panel"><h3>Уровень ${level}</h3><div class="row wrap">${rows.map((x) => `<a class="requirement" href="#/item/${db.mode}/${x.item?.normalizedName}">${img(x.item?.iconLink, x.item?.name)}<span>${esc(x.item?.shortName || x.item?.name)} × ${x.count.toLocaleString("ru-RU")}</span></a>`).join("")}</div><button data-build="${level}">${(current().hideout[slug] || 0) >= level ? "✓ Построено" : "Отметить построенным"}</button></section>`,
    )
    .join("");
}
export function renderModifiers(root) {
  function draw() {
    const selected = current().modifiers,
      result = modifierResult(db.modifiers, selected);
    root.innerHTML =
      heading(
        "Kord Breach · модификаторы",
        "Калькулятор сезонного билда и несовместимых эффектов",
        `<div class="points ${result.valid ? "positive" : "negative"}">${result.points} очков</div><button id="clear-build">Сбросить билд</button>`,
      ) +
      `<div class="notice">Положительные эффекты расходуют очки, отрицательные дают очки. Итог должен быть не ниже нуля.${result.conflicts.length ? "<br>Есть несовместимые модификаторы: " + result.conflicts.map(([a, b]) => esc(db.modifiers.find((x) => x.id === a)?.name) + " / " + esc(db.modifiers.find((x) => x.id === b)?.name)).join(", ") : ""}</div><div class="card-grid modifiers">${db.modifiers.map((x) => `<label class="card modifier ${selected.includes(x.id) ? "chosen" : ""}"><input type="checkbox" value="${x.id}" ${selected.includes(x.id) ? "checked" : ""}>${img(x.icon, x.name)}<span class="badge ${x.points < 0 ? "negative" : "positive"}">${x.points > 0 ? "+" : ""}${x.points}</span><h3>${esc(x.name)}</h3><p class="muted small">${esc(x.description)}</p></label>`).join("")}</div>`;
    root.querySelectorAll(".modifier input").forEach(
      (e) =>
        (e.onchange = () => {
          current().modifiers = e.checked
            ? [...selected, e.value]
            : selected.filter((x) => x !== e.value);
          save();
          draw();
        }),
    );
    root.querySelector("#clear-build").onclick = () => {
      current().modifiers = [];
      save();
      draw();
    };
  }
  draw();
}
export async function renderSettings(root) {
  const quality = await json("quest-content-report.json").catch(() => null);
  const qualitySummary = Object.entries(quality?.summary || {})
    .map(
      ([mode, value]) =>
        `<p><b>${mode === "pve" ? "PvE" : "PvP"}:</b> ${value.guides} авторских прохождений из ${value.quests} заданий. Для ${value.withoutGuide} заданий без отдельного прохождения доступен краткий план по сохранённым целям.</p>`,
    )
    .join("");
  root.innerHTML =
    heading(
      "Настройки",
      "Внешний вид, локальная база и сохранение прогресса.",
    ) +
    `<section class="panel"><h2>Интерфейс и карта</h2><div id="page-preferences"></div></section><section class="panel"><h2>Приложение и обновления</h2><p>Тарков GPS · версия 1.5.0.</p><div class="row wrap"><button data-desktop-command="update-data">Обновить базу</button><button data-desktop-command="install-update">Установить обновление приложения</button><button data-desktop-command="open-folder">Открыть папку приложения</button><button data-desktop-command="reload-interface">Перезагрузить интерфейс</button></div><p class="muted small">База обновляется из интернета. Приложение обновляется из выбранного ZIP-пакета. Кнопки доступны в отдельном окне приложения.</p></section><h2>Данные и прогресс</h2><div class="stats">${Object.entries(
      db.manifest.counts || {},
    )
      .map(
        ([k, v]) =>
          `<div class="stat"><span>${esc({ items: "Предметы", quests: "Задания", maps: "Карты", articles: "Руководства", assets: "Изображения", pveQuests: "Задания PvE" }[k] || k)}</span><strong>${Number(v).toLocaleString("ru-RU")}</strong></div>`,
      )
      .join(
        "",
      )}</div><section class="panel"><h2>Офлайн-база</h2><p>Сохранена ${new Date(db.manifest.savedAt).toLocaleString("ru-RU")}.</p><p class="muted">Цены, шансы боссов и события соответствуют снимку. Локальный GPS работает по файлам скриншотов. PvP и PvE имеют отдельные каталоги, карточки предметов, задания, карты и требования трекера. Справочные статьи и ассортимент торговцев используют общий снимок PvP.</p><p>Обновление: закройте приложение и запустите <b>Обновить базу.cmd</b> в папке приложения. Во время обновления нужен интернет.</p><details><summary>Доступность материалов</summary>${qualitySummary}<p>Недоступных изображений в отчёте базы: ${db.manifest.failures?.length || 0}. Если источник удалил иллюстрацию, приложение показывает пояснение. Работа карт, целей и прогресса от этого не зависит.</p></details></section><section class="panel"><h2>Прогресс</h2><p>Автоматически сохраняется в папку userdata рядом с приложением и в хранилище окна.</p><div class="row wrap"><button class="primary" id="export-profile">↓ Сохранить резервную копию</button><label class="button">↑ Восстановить из файла<input type="file" id="import-profile" accept="application/json,.json" hidden></label></div><p class="muted small">Импорт заменяет текущий прогресс. Сначала сохраните резервную копию.</p></section><section class="panel"><h2>Заметки</h2><textarea id="notes" rows="7" placeholder="Планы на рейд, ключи, маршруты…">${esc(current().notes)}</textarea><p class="muted small">Заметки сохраняются автоматически для выбранного режима.</p></section><section class="panel"><h2>Тарков GPS</h2><p>Карты, GPS и подготовка к рейдам Escape from Tarkov. Независимое приложение сообщества.</p><p>Игровые материалы © Battlestate Games. <a href="https://www.escapefromtarkov.com/" target="_blank" rel="noopener">Официальный сайт игры ↗</a></p></section>`;
  renderPreferences(root.querySelector("#page-preferences"));
  bindDesktopActions(root);
  root.querySelector("#export-profile").onclick = exportProfile;
  root.querySelector("#import-profile").onchange = async (e) => {
    try {
      const f = e.target.files[0];
      if (!f) return;
      const p = JSON.parse(await f.text());
      if (
        !(await confirmAction(
          "Восстановление прогресса",
          "Данные из выбранного файла заменят текущий прогресс. Сначала сохраните резервную копию.",
          "Заменить прогресс",
        ))
      )
        return;
      replaceState(p);
      toast("Резервная копия восстановлена");
      location.reload();
    } catch (e) {
      toast("Импорт не выполнен: " + e.message);
    }
  };
  let timer;
  root.querySelector("#notes").oninput = (e) => {
    const value = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      current().notes = value;
      save();
    }, 300);
  };
}
