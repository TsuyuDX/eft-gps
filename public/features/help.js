import {startInteractiveTour} from "../core/interactive-tour.js";
import {textPair} from "../core/localization.js";
import { supportUrl } from "../core/support-config.js";
import { language } from "../core/localization.js";
import { openSupport } from "./support.js";
import { modal, esc, toast } from "../core/ui.js";
import {
  readWindowSetting,
  writeWindowSetting,
} from "../core/window-settings.js";
import { db } from "../core/data.js";
import {
  APP_NAME,
  APP_VERSION,
  APP_TITLE,
  PROJECT_URL,
} from "../core/brand.js";
const L = textPair;
const tourKey = "tarkov-onboarding-v1";
export function hasSeenTour() {
  try {
    return JSON.parse(readWindowSetting(tourKey))?.completed === true;
  } catch {
    return false;
  }
}
export function openTour() { startInteractiveTour(); }
export function maybeShowTour() {
  if (!hasSeenTour()) openTour();
}
const faq = [
  [
    [
      "Как обновляются прохождения события?",
      "How do event walkthroughs update?",
    ],
    [
      "При запуске и раз в 15 минут приложение проверяет новые материалы Хэллоуина. Новые задания, прохождения и изображения сохраняются на компьютере. В разделе «События → Хэллоуин 2026» есть кнопка «Проверить сейчас». Если источник недоступен, используются сохранённые данные; личный прогресс не меняется.",
      "At startup and every 15 minutes, the app checks for new Halloween content. New quests, walkthroughs and images are saved locally. Open Events → Halloween 2026 and select Check now for a manual check. If the source is unavailable, saved content remains usable; personal progress is unchanged.",
    ],
  ],
  [
    ["Нужен ли интернет?", "Do I need internet?"],
    [
      "Карты, справочник и сохранённые иллюстрации работают без сети. Интернет нужен для обновлений и открытия внешних ссылок.",
      "Maps, reference data and saved images work offline. Internet is needed for updates and external links.",
    ],
  ],
  [
    [
      "GPS показывает движение непрерывно?",
      "Does GPS track movement continuously?",
    ],
    [
      "Нет. GPS читает координаты нового игрового скриншота и показывает время последнего определения. Без нового снимка позиция остаётся прежней.",
      "No. GPS reads coordinates from new game screenshots and shows the last detection time. Without a new screenshot, the position stays unchanged.",
    ],
  ],
  [
    [
      "Почему не найдена папка скриншотов?",
      "Why is my screenshot folder missing?",
    ],
    [
      "Сначала сделайте игровой скриншот. Затем выберите папку в разделе GPS, если автоматический поиск её не обнаружил.",
      "Take a screenshot in the game first. Then choose the folder in GPS settings if automatic discovery did not find it.",
    ],
  ],
  [
    ["Какие снимки удаляет очистка?", "Which screenshots does cleanup delete?"],
    [
      "Только обработанные снимки, появившиеся во время сеанса автосъёмки, включая сделанные вручную в этот период. Старые снимки и файлы вне сеанса сохраняются.",
      "Only processed screenshots created during the auto-capture session, including manual screenshots taken during that session. Older screenshots and files outside the session are kept.",
    ],
  ],
  [
    ["Как перенести прогресс?", "How do I transfer progress?"],
    [
      "Сохраните резервную копию в настройках. Для переноса всех настроек закройте программу и скопируйте папку userdata вместе с приложением.",
      "Save a backup in Settings. To transfer every setting, close the application and copy its userdata folder along with the application.",
    ],
  ],
  [
    ["Где поменять язык?", "Where can I change language?"],
    [
      "Нажмите «Настройки» и выберите язык интерфейса. Сохранённые игровые тексты переключаются вместе с ним и не требуют подключения к сети.",
      "Open Settings and select your language. Saved game content switches with it and does not require a network connection.",
    ],
  ],
];
function faqPanel() {
  modal(
    `<h2>${L("Частые вопросы", "Frequently asked questions")}</h2><div class="help-faq">${faq.map(([q, a]) => `<details><summary>${esc(L(...q))}</summary><p data-selectable>${esc(L(...a))}</p></details>`).join("")}</div>`,
  );
}
function reportPanel() {
  const report = `${APP_TITLE}\nMode: ${db.mode}\nLanguage: ${language()}\nDatabase: ${db.manifest.savedAt || "unknown"}\n\n${L("Что произошло:\n\nШаги для повторения:\n", "What happened:\n\nSteps to reproduce:\n")}`;
  modal(
    `<h2>${L("Сообщить об ошибке", "Report a bug")}</h2><p>${L("Создайте отчёт на GitHub или скопируйте шаблон. Личные пути, заметки и прогресс в него не включены.", "Create a GitHub issue or copy the template. Personal paths, notes and progress are not included.")}</p><textarea id="bug-report" rows="9" data-no-translate>${esc(report)}</textarea><div class="row wrap"><button id="copy-report">${L("Скопировать шаблон", "Copy template")}</button><a class="button primary" href="${PROJECT_URL}/issues/new" target="_blank" rel="noopener">GitHub ↗</a></div>`,
  );
  document.querySelector("#copy-report").onclick = async () => {
    try {
      await navigator.clipboard.writeText(
        document.querySelector("#bug-report").value,
      );
      toast(L("Шаблон скопирован", "Template copied"));
    } catch {
      document.querySelector("#bug-report").select();
      toast(
        L(
          "Скопируйте выделенный текст сочетанием Ctrl+C",
          "Copy the selected text with Ctrl+C",
        ),
      );
    }
  };
}
function changesPanel() {
  modal(
    `<h2>${L("Список изменений", "Release notes")}</h2><section class="help-change"><h3>1.9.0 · ${APP_NAME}</h3><p>${L("Обновлённая карта, общий поиск, два стиля меток, прохождения Хэллоуина с офлайн-кэшем, превью новостей и Discord.", "Redesigned maps, unified search, two marker styles, Halloween walkthroughs with offline caching, news previews and Discord.")}</p><h3>1.7.0 · ${APP_NAME}</h3><p>${L("Новое название с ником автора, английская база и интерфейс, первый обзор, помощь и кнопки сообщества.", "New creator-branded name, English game data and interface, first-run tour, help and community buttons.")}</p><h3>1.6.0</h3><p>${L("Экран подготовки, проверка путей, выбор языка и полупрозрачные скроллбары.", "Preparation screen, path checks, language selection and translucent scrollbars.")}</p><h3>1.5.0</h3><p>${L("Обновлённый интерфейс, собственные новости приложения и единый стиль установщика.", "Updated interface, application news and a unified installer style.")}</p></section><a class="button" href="${PROJECT_URL}/releases" target="_blank" rel="noopener">${L("Все выпуски на GitHub ↗", "All GitHub releases ↗")}</a>`,
  );
}
function creditsPanel() {
  modal(
    `<h2>${L("Об приложении", "About")}</h2><h3>${esc(APP_TITLE)}</h3><p>${L("Автор проекта — T_S_U_Y_U. Карты, GPS и подготовка к рейдам Escape from Tarkov.", "Created by T_S_U_Y_U. Maps, GPS and raid preparation for Escape from Tarkov.")}</p><p>${L("Игровые материалы © Battlestate Games. Независимое приложение сообщества.", "Game assets © Battlestate Games. An independent community application.")}</p><a class="button" href="${PROJECT_URL}" target="_blank" rel="noopener">GitHub ↗</a>`,
  );
}
export function openHelp() {
  const rows = [
    [
      "tour",
      L("Повторить обзор", "Replay tour"),
      L(
        "Короткое знакомство с приложением",
        "A short introduction to the application",
      ),
      L("Повторить", "Replay"),
    ],
    [
      "bug",
      L("Сообщить об ошибке", "Report a bug"),
      L(
        "Шаблон отчёта без личных данных и ссылка на GitHub",
        "A report template without personal data and a GitHub link",
      ),
      L("Открыть", "Open"),
    ],
    [
      "faq",
      "FAQ",
      L(
        "Ответы на вопросы о GPS, прогрессе и работе без сети",
        "Answers about GPS, progress and offline use",
      ),
      L("Открыть", "Open"),
    ],
    [
      "idea",
      L("Предложить идею", "Suggest a feature"),
      L(
        "Напишите предложение в Issues проекта",
        "Submit a suggestion in project Issues",
      ),
      L("Открыть", "Open"),
    ],
    [
      "discord",
      "Discord",
      L(
        "Общение, помощь и новости приложения",
        "Community chat, help and app news",
      ),
      L("Открыть", "Open"),
    ],
    [
      "support",
      L("Поддержать проект", "Support the project"),
      L(
        "Добровольная поддержка разработки · Boosty и Ko-fi",
        "Optional development support · Boosty and Ko-fi",
      ),
      L("Открыть", "Open"),
    ],
    [
      "changes",
      L("Список изменений", "Release notes"),
      L(
        "Что изменилось в последних версиях",
        "What changed in recent versions",
      ),
      L("Открыть", "Open"),
    ],
    [
      "about",
      L("Авторы и приложение", "Credits and about"),
      APP_NAME,
      L("Открыть", "Open"),
    ],
  ];
  modal(
    `<div id="help-panel"><h2>${L("Помощь", "Help")}</h2>${rows.map(([id, title, description, button]) => `<div class="help-row"><div><strong>${esc(title)}</strong><small>${esc(description)}</small></div>${id === "discord" && supportUrl("discord") ? `<a class="button" data-help-action="discord" href="${esc(supportUrl("discord"))}" target="_blank" rel="noopener noreferrer">${button} ↗</a>` : id === "idea" ? `<a class="button" href="${PROJECT_URL}/issues/new" target="_blank" rel="noopener">${button} ↗</a>` : `<button data-help-action="${id}" ${id === "discord" ? 'disabled aria-disabled="true"' : ""}>${button}</button>`}</div>`).join("")}</div>`,
  );
  const actions = {
    tour: openTour,
    bug: reportPanel,
    faq: faqPanel,
    changes: changesPanel,
    about: creditsPanel,
    support: () => openSupport(),
  };
  document
    .querySelectorAll("[data-help-action]")
    .forEach((button) => (button.onclick = actions[button.dataset.helpAction]));
}
