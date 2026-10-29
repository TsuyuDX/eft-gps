import { bindMarkerStyleControls, markerStyleOptions } from "./marker-style.js";
import { languageControl } from "./localization.js";
import { readWindowSetting, writeWindowSetting } from "./window-settings.js";
import { modal, toast } from "./ui.js";

const storageKey = "tarkov-interface-v1";
export const preferenceGroups = [
  [
    "Интерфейс",
    [
      ["clock", "Время в Таркове", "Часы в верхней панели."],
      [
        "snapshot",
        "Дата базы",
        "Дата сохранения справочника в верхней панели.",
      ],
      [
        "footer",
        "Нижняя панель",
        "Источники данных и ссылка на состояние базы.",
      ],
      ["news", "Новости на главной", "Карточки новостей под поиском."],
    ],
  ],
  [
    "Карта",
    [
      [
        "sidebar",
        "Панель слоёв",
        "Категории меток и свои отметки слева от карты.",
      ],
      [
        "questBrowser",
        "Панель заданий",
        "Список заданий справа от карты. Общий поиск находится сверху.",
      ],
      [
        "markerList",
        "Список видимых меток",
        "Текстовый список под переключателями слоёв.",
      ],
      [
        "questBadges",
        "Значки заданий на метках",
        "Дополнительная иконка задания рядом с основной меткой.",
      ],
      [
        "gpsStatus",
        "Статус GPS на карте",
        "Информационная плашка. Работа GPS от неё не зависит.",
      ],
      [
        "mapCaption",
        "Название карты и масштаб",
        "Подпись в правом нижнем углу.",
      ],
    ],
  ],
];
export const preferenceDefaults = Object.fromEntries(
  preferenceGroups.flatMap(([, rows]) => rows.map(([key]) => [key, true])),
);
export function normalizePreferences(value) {
  return Object.fromEntries(
    Object.entries(preferenceDefaults).map(([key, fallback]) => [
      key,
      typeof value?.[key] === "boolean" ? value[key] : fallback,
    ]),
  );
}
export function getPreferences() {
  try {
    return normalizePreferences(JSON.parse(readWindowSetting(storageKey)));
  } catch {
    return { ...preferenceDefaults };
  }
}
export function applyPreferences() {
  for (const [key, visible] of Object.entries(getPreferences()))
    document.documentElement.classList.toggle("hide-" + key, !visible);
}
function storePreferences(value) {
  try {
    writeWindowSetting(storageKey, JSON.stringify(value));
  } catch {
    toast("Не удалось сохранить настройки окна");
    return;
  }
  applyPreferences();
  window.dispatchEvent(new Event("preferences-changed"));
}
export function renderPreferences(root, selected = "Интерфейс") {
  const prefs = getPreferences();
  root.innerHTML = `<div class="preference-tabs" role="group" aria-label="Разделы настроек">${["Интерфейс", "Карта", "Оформление"].map((title) => `<button type="button" data-preference-tab="${title}" aria-pressed="false">${title}</button>`).join("")}</div><p class="muted">Изменения применяются сразу и сохраняются в этом окне. Прогресс заданий и настройки GPS не меняются.</p>${preferenceGroups.map(([title, rows]) => `<section class="preference-group" data-preference-panel="${title}"><h3>${title}</h3>${rows.map(([key, label, description]) => `<label class="preference-row"><span><strong>${label}</strong><small class="muted">${description}</small></span><input type="checkbox" data-preference="${key}" ${prefs[key] ? "checked" : ""}></label>`).join("")}</section>`).join("")}<section class="preference-group" data-preference-panel="Оформление"><h3>Оформление</h3><div class="preference-row"><span><strong>Тема приложения</strong><small class="muted">Сейчас используется чёрная тема. Другие темы скоро будут доступны.</small></span><button disabled title="Новые темы скоро будут доступны">Выбор темы · скоро будет</button></div></section><button type="button" data-reset-preferences>Вернуть стандартный вид</button><p class="muted small">Слои и разновидности меток выбираются на самой карте и запоминаются отдельно для каждой локации и режима. Зоны опасностей включаются там же.</p>`;
  const mapPanel = root.querySelector('[data-preference-panel="Карта"]');
  mapPanel?.insertAdjacentHTML(
    "afterbegin",
    '<label class="preference-row"><span><strong>Стиль меток</strong><small class="muted">Новый набор EFT GPS или прежние значки. Выбор сохраняется для всех карт.</small></span><select data-marker-style aria-label="Стиль меток">' +
      markerStyleOptions +
      "</select></label>",
  );
  bindMarkerStyleControls(root);
  languageControl(root);
  const choose = (title) => {
    selected = title;
    root
      .querySelectorAll("[data-preference-tab]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.preferenceTab === title),
        ),
      );
    root.querySelectorAll("[data-preference-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.preferencePanel !== title;
    });
  };
  root
    .querySelectorAll("[data-preference-tab]")
    .forEach(
      (button) => (button.onclick = () => choose(button.dataset.preferenceTab)),
    );
  choose(
    ["Интерфейс", "Карта", "Оформление"].includes(selected)
      ? selected
      : "Интерфейс",
  );
  root.querySelectorAll("[data-preference]").forEach(
    (input) =>
      (input.onchange = () =>
        storePreferences({
          ...getPreferences(),
          [input.dataset.preference]: input.checked,
        })),
  );
  root.querySelector("[data-reset-preferences]").onclick = () => {
    storePreferences({ ...preferenceDefaults });
    renderPreferences(root, selected);
    toast("Стандартный вид восстановлен");
  };
}
export function openPreferences(selected = "Интерфейс") {
  modal(
    '<h2 id="preferences-title">Настройки интерфейса</h2><div id="preferences-controls"></div><p><a class="button" href="#/settings">Данные, резервные копии и заметки →</a></p>',
  );
  renderPreferences(document.querySelector("#preferences-controls"), selected);
}

export function setPreference(key, value) {
  if (!(key in preferenceDefaults)) return;
  storePreferences({ ...getPreferences(), [key]: Boolean(value) });
}
