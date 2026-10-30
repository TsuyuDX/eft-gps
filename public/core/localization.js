import { englishUi } from "./english-ui.js";
import { translatePattern } from "./english-patterns.js";
import { readWindowSetting, writeWindowSetting } from "./window-settings.js";
const words = {
  "EFT GPS 1.9.0: карты, прохождения и сообщество":
    "EFT GPS 1.9.0: maps, walkthroughs and community",
  "Общий поиск, удобные панели карты, два стиля меток, обновляемые прохождения события и наш Discord.":
    "Unified search, convenient map panels, two marker styles, refreshed event walkthroughs and our Discord.",
  "Панели фильтров и заданий можно скрывать отдельно. Общий поиск помогает находить задания, предметы и точки карты. Доступны классические и новые цветные значки, подписи выходов и подсветка зон опасностей.":
    "Hide the filter and quest panels independently. Unified search finds quests, items and map locations. Choose classic or modern coloured markers, with destination labels and highlighted hazard zones.",
  "Прохождения Хэллоуина 2026 проверяются при запуске и каждые 15 минут при открытом приложении. Новые инструкции и изображения сохраняются для работы без интернета. В карточке события есть ручная проверка.":
    "Halloween 2026 walkthroughs are checked at startup and every 15 minutes while the application is open. New instructions and images are saved for offline use. The event page also offers a manual check.",
  "Новости получили превью, окна и кнопки стали удобнее, а Discord теперь доступен из верхней панели, помощи и поддержки. Личный прогресс и настройки сохраняются при обновлении.":
    "News now has previews, dialogs and controls are easier to use, and Discord is available from the top bar, Help and Support. Updates preserve your personal progress and settings.",
  "Иллюстрация Battlestate Games": "Illustration by Battlestate Games",
  "Интерфейс EFT GPS · иллюстрация возможностей приложения":
    "EFT GPS interface · illustrative application view",
  "Прохождения события обновлены": "Event walkthroughs updated",
  "Вид указателя": "Navigation cursor preview",
  "Хэллоуин 2026 · временные": "Halloween 2026 · limited-time",
  "Хэллоуин 2026": "Halloween 2026",
  "Хэллоуин 2026 · временное задание": "Halloween 2026 · limited-time quest",
  ...englishUi,
  Карты: "Maps",
  GPS: "GPS",
  Задания: "Quests",
  Предметы: "Items",
  "Мой прогресс": "My progress",
  Убежище: "Hideout",
  Торговцы: "Traders",
  Боссы: "Bosses",
  События: "Events",
  Сезоны: "Seasons",
  Новости: "News",
  Настройки: "Settings",
  "⚙ Настройки": "⚙ Settings",
  "EFT GPS": "EFT GPS",
  Тарков: "Tarkov",
  "НАВИГАЦИЯ ДЛЯ РЕЙДА": "RAID NAVIGATION",
  "НАВИГАЦИЯ / ПОДГОТОВКА / РЕЙД": "NAVIGATE / PREPARE / RAID",
  "EFT GPS / ПОМОЩНИК В РЕЙДЕ": "EFT GPS / RAID COMPANION",
  "Всё для следующего рейда. Карты, GPS, задания и личный прогресс.":
    "Everything for your next raid. Maps, GPS, quests and personal progress.",
  "Открыть карты ↗": "Open maps ↗",
  "Настроить GPS": "Set up GPS",
  "Найти предметы, задания, модули убежища":
    "Search items, quests and hideout modules",
  "Ничего не найдено": "Nothing found",
  "На связи с Тарковом": "Stay connected to Tarkov",
  "Все новости →": "All news →",
  Все: "All",
  Приложение: "Application",
  Игра: "Game",
  "Подробнее ↗": "Read more ↗",
  "Подробнее →": "Details →",
  "Локальная база": "Local database",
  "Состояние офлайн-базы": "Database status",
  Интерфейс: "Interface",
  Карта: "Map",
  Оформление: "Appearance",
  "Настройки интерфейса": "Interface settings",
  "Интерфейс и карта": "Interface and map",
  "Тема приложения": "Application theme",
  "Другие темы скоро будут доступны.": "More themes are coming soon.",
  "Скоро будут": "Coming soon",
  Скоро: "Coming soon",
  "Выбор темы · скоро будет": "Themes · coming soon",
  "Данные, резервные копии и заметки →": "Data, backups and notes →",
  "Вернуть стандартный вид": "Restore default appearance",
  "Приложение и обновления": "Application and updates",
  "Обновить базу": "Update database",
  "Установить обновление приложения": "Install application update",
  "Открыть папку приложения": "Open application folder",
  "Перезагрузить интерфейс": "Reload interface",
  "Данные и прогресс": "Data and progress",
  "Офлайн-база": "Offline database",
  Прогресс: "Progress",
  Заметки: "Notes",
  "Планы на рейд, ключи, маршруты…": "Raid plans, keys, routes…",
  "Доступность материалов": "Available content",
  "↓ Сохранить резервную копию": "↓ Save backup",
  "↑ Восстановить из файла": "↑ Restore from file",
  "Время в Таркове": "Tarkov time",
  "Дата базы": "Database date",
  "Подвал приложения": "Footer",
  "Новости на главной": "Home news",
  "Боковая панель": "Sidebar",
  "Панель заданий": "Quest panel",
  "Список меток": "Marker list",
  "Значки заданий": "Quest badges",
  "Статус GPS": "GPS status",
  "Подпись карты": "Map caption",
  "Основной слой": "Main layer",
  "Настройки карты": "Map settings",
  "Развернуть карту": "Expand map",
  "Свернуть карту": "Collapse map",
  "Настройки интерфейса и карты": "Interface and map settings",
  "Слои карты": "Map layers",
  "Видимые метки": "Visible markers",
  "Показывать все зоны опасностей": "Show all hazard zones",
  "Найти выход, задание, ключ…": "Find an extract, quest, key…",
  "Название, цель, предмет…": "Name, objective, item…",
  "Задания на карте": "Quests on the map",
  "＋ Своя метка": "＋ Add marker",
  "Боссы и шанс появления": "Bosses and spawn chances",
  Приблизить: "Zoom in",
  Отдалить: "Zoom out",
  "Сбросить масштаб": "Reset zoom",
  Контейнеры: "Containers",
  Выходы: "Extracts",
  "Точки появления": "Spawn points",
  "Ключи и двери": "Keys and doors",
  Опасности: "Hazards",
  "Миномётные обстрелы": "Mortar strikes",
  Переключатели: "Switches",
  "Стационарное оружие": "Mounted weapons",
  Переходы: "Transits",
  "Сезонные документы": "Seasonal documents",
  "Предметы на карте": "Loose loot",
  "Справочник доступен без интернета": "Reference available offline",
  "Поиск по названию…": "Search by name…",
  "Поиск в разделе": "Search this section",
  "Ничего не найдено. Попробуйте другое название.":
    "Nothing found. Try a different name.",
  "Поиск заданий": "Search quests",
  Торговец: "Trader",
  "Все торговцы": "All traders",
  Выполненные: "Completed",
  "Не выполненные": "Incomplete",
  Избранное: "Favorites",
  "Только избранное": "Favorites only",
  Цели: "Objectives",
  Прохождение: "Walkthrough",
  Награды: "Rewards",
  Требования: "Requirements",
  Ключи: "Keys",
  Закрыть: "Close",
  Отмена: "Cancel",
  Сохранить: "Save",
  Подтвердить: "Confirm",
  Удалить: "Delete",
  Поиск: "Search",
  Описание: "Description",
  Характеристики: "Properties",
  Покупка: "Buy",
  Продажа: "Sell",
  Уровень: "Level",
  "Схема обмена": "Barter",
  Ассортимент: "Inventory",
  "Все уровни": "All levels",
  "Найти в ассортименте": "Search inventory",
  "Уровни лояльности": "Loyalty levels",
  "GPS по игровым скриншотам": "GPS from game screenshots",
  "Папка скриншотов": "Screenshot folder",
  "Логи игры": "Game logs",
  "Модуль GPS": "GPS module",
  "Путь к папке": "Folder path",
  "Выбрать папку": "Choose folder",
  "Обзор…": "Browse…",
  "Сохранить настройки GPS": "Save GPS settings",
  "Начать автосъёмку": "Start auto capture",
  Остановить: "Stop",
  Автообновление: "Auto refresh",
  "Что будет видно": "What you will see",
  "Подтверждаю, что я уже в рейде": "I confirm I am already in a raid",
  "Моя карта →": "My map →",
  Автосъёмка: "Auto capture",
  "Состояние рейда": "Raid status",
  "Очистка GPS-скриншотов": "GPS screenshot cleanup",
  "Удалено за запуск": "Deleted this session",
  "Последняя позиция": "Last position",
  "Координаты X / Y / Z": "Coordinates X / Y / Z",
  Направление: "Heading",
  Найдена: "Found",
  "Не найдена": "Not found",
  Выключена: "Off",
  Включена: "On",
  "Не определено": "Unknown",
  "В рейде": "In raid",
  Загрузка: "Loading",
  "Рейд завершён": "Raid ended",
  "Ещё не получена": "Not received yet",
  "Ожидание окна игры": "Waiting for game window",
  "Пауза: окно игры не активно": "Paused: game window is not active",
  "Клавиша отправляется в игру": "Sending screenshot key",
  "Windows не приняла нажатие": "Windows blocked the key press",
  "Язык интерфейса": "Interface language",
  Русский: "Русский",
  "Язык применяется к интерфейсу, предметам, заданиям и справочнику.":
    "Language applies to the interface, items, quests and reference content.",
  "Подключение к приложению…": "Connecting to application…",
  "Проверка заняла слишком много времени. Повторите попытку.":
    "Checks timed out. Please retry.",
  "Перезапустите приложение, чтобы выполнить проверку запуска.":
    "Restart the application to run startup checks.",
  "Не удалось проверить базу или записать сохранения. Проверьте папку приложения и повторите запуск.":
    "Could not verify the database or save progress. Check the application folder and retry.",
  "Открываем интерфейс и личный профиль…":
    "Opening your interface and profile…",
  "Модуль GPS не найден. Переустановите приложение для автосъёмки. Карты и справочник доступны.":
    "GPS module not found. Reinstall the application for auto capture. Maps and reference are available.",
  "Подготовка к рейду": "Preparing for your raid",
  "Проверяем компоненты и локальные данные":
    "Checking components and local data",
  "Локальная база": "Local database",
  "Карты и справочник": "Maps and reference",
  "Сохранение прогресса": "Progress storage",
  "Подключение к приложению": "Application connection",
  "Настройки GPS": "GPS settings",
  "Проверка завершена": "Checks complete",
  Готово: "Ready",
  "Не найдено": "Not found",
  "Требует внимания": "Needs attention",
  Ошибка: "Error",
  "Проверяем…": "Checking…",
  "Повторить проверку": "Retry checks",
  "Открыть приложение": "Open application",
  "Открыть настройки GPS": "Open GPS settings",
  "Продолжить без GPS": "Continue without GPS",
  "Путь можно выбрать в настройках GPS. Карты и справочник доступны без него.":
    "Choose a path in GPS settings. Maps and reference work without it.",
  "Не удалось подготовить приложение": "Could not prepare the application",
  "Проверка путей не включает автосъёмку и не удаляет скриншоты.":
    "Path checks do not enable capture or delete screenshots.",
  "Изменения применяются сразу и сохраняются в этом окне. Прогресс заданий и настройки GPS не меняются.":
    "Changes apply immediately and are saved. Quest progress and GPS settings remain unchanged.",
  "Сейчас используется чёрная тема.": "The black theme is currently active.",
  "Слои и разновидности меток выбираются на самой карте и запоминаются отдельно для каждой локации и режима. Зоны опасностей включаются там же.":
    "Select marker types and layers on each map. Your choices are saved per location and mode. Hazard zones are controlled there as well.",
  "Колесо — масштаб · перетаскивание — перемещение. Свои метки сохраняются в профиле.":
    "Wheel to zoom · drag to pan. Personal markers are saved in your profile.",
};
let extraWords = {};
export function setContentTranslations(value) {
  extraWords = value || {};
}
export const localeCode = () => (locale === "en" ? "en-US" : "ru-RU");
let locale = "ru",
  observer = null;
const originals = new WeakMap();
export const language = () => locale;
export function savedLanguage() {
  try {
    const value = JSON.parse(readWindowSetting("tarkov-locale-v1"));
    return ["ru", "en"].includes(value?.language) ? value.language : null;
  } catch {
    return null;
  }
}
export function t(text) {
  if (locale === "ru") return text;
  const value = String(text),
    trim = value.trim();
  let result = words[trim] ?? extraWords[trim];
  if (result === undefined) {
    const patterns = [
      [
        /^← (Карты|Задания|Предметы|Новости|Торговцы|Боссы|События|Сезоны)$/,
        (m, n) => "← " + (words[n] || n),
      ],
      [/^Снимок (.+)$/, (m, n) => "Snapshot " + n],
      [/^Показано: (\d+) из (\d+)$/, (m, a, b) => `Showing: ${a} of ${b}`],
      [/^Уровень (\d+)$/, (m, n) => "Level " + n],
      [/^EFT GPS · версия (.+)\.$/, (m, n) => "EFT GPS · version " + n + "."],
      [/^(\d+) сек\. назад$/, (m, n) => n + " sec ago"],
      [/^GPS: ожидание позиции$/, "GPS: waiting for position"],
      [/^⌖ GPS · вкл$/, "⌖ GPS · on"],
      [/^⌖ GPS · выкл$/, "⌖ GPS · off"],
      [/^⌖ GPS · авто$/, "⌖ GPS · auto"],
    ];
    result = translatePattern(trim);
    for (const [pattern, replacement] of patterns)
      if (pattern.test(trim)) {
        result = trim.replace(pattern, replacement);
        break;
      }
  }
  result = result.replace(
    /(\d+)\s+(мин|точка|точки|точек)(?![а-яё])/gi,
    (_, count, unit) =>
      count +
      " " +
      (unit.toLowerCase() === "мин"
        ? "min"
        : Number(count) === 1
          ? "point"
          : "points"),
  );
  return value.replace(trim, result);
}
function translate(root) {
  if (!root || (!root.ownerDocument && root.nodeType !== 9)) return;
  const doc = root.ownerDocument || root;
  function node(n) {
    const old = originals.get(n);
    const source = old && n.nodeValue === old.output ? old.source : n.nodeValue;
    const output = t(source);
    originals.set(n, { source, output });
    if (n.nodeValue !== output) n.nodeValue = output;
  }
  if (root.nodeType === 3) {
    if (
      !root.parentElement?.closest("script,style,textarea,[data-no-translate]")
    )
      node(root);
    return;
  }
  const walker = doc.createTreeWalker(root, 4);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.parentElement?.closest("script,style,textarea,[data-no-translate]"))
      node(n);
  }
  for (const el of [
    ...(root.matches?.("[placeholder],[title],[aria-label]") ? [root] : []),
    ...(root.querySelectorAll?.("[placeholder],[title],[aria-label]") || []),
  ]) {
    if (el.closest("[data-no-translate]")) continue;
    let record = originals.get(el) || {};
    for (const key of ["placeholder", "title", "aria-label"]) {
      if (!el.hasAttribute(key)) continue;
      const actual = el.getAttribute(key),
        old = record[key];
      const source = old && actual === old.output ? old.source : actual;
      const output = t(source);
      record[key] = { source, output };
      if (actual !== output) el.setAttribute(key, output);
    }
    originals.set(el, record);
  }
}
export function setLanguage(value, { persist = true } = {}) {
  locale = ["ru", "en"].includes(value) ? value : "ru";
  document.documentElement.lang = locale;
  if (persist)
    writeWindowSetting(
      "tarkov-locale-v1",
      JSON.stringify({ language: locale }),
    );
  if (observer) observer.disconnect();
  translate(document.body);
  if (observer) observe();
  window.dispatchEvent(new Event("language-changed"));
}
function observe() {
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "title", "aria-label"],
  });
}
export function installLocalization() {
  if (observer) return;
  observer = new MutationObserver((records) => {
    observer.disconnect();
    for (const record of records) {
      if (record.type === "childList")
        for (const n of record.addedNodes) translate(n);
      else translate(record.target);
    }
    observe();
  });
  translate(document.body);
  observe();
}
export function languageControl(root) {
  const row = document.createElement("label");
  row.className = "preference-row";
  row.innerHTML =
    '<span><strong>Язык интерфейса</strong><small class="muted">Язык применяется к интерфейсу, предметам, заданиям и справочнику.</small></span><select aria-label="Язык интерфейса"><option value="ru">Русский</option><option value="en">English</option></select>';
  const select = row.querySelector("select");
  select.value = locale;
  select.onchange = () => setLanguage(select.value);
  root.prepend(row);
  translate(row);
}
