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
const L = (ru, en) => (language() === "en" ? en : ru);
const tourKey = "tarkov-onboarding-v1";
const steps = [
  {
    symbol: "⌖",
    title: ["Добро пожаловать в EFT GPS", "Welcome to EFT GPS"],
    body: [
      "Карты, задания, предметы и подготовка к рейду — в одном окне. Всё сохранённое доступно без интернета. Этот короткий обзор покажет, с чего начать.",
      "Maps, quests, items and raid preparation in one window. Saved content works offline. This short tour shows you where to start.",
    ],
    tip: [
      "Выбранный язык можно поменять в настройках.",
      "You can change your language in Settings.",
    ],
  },
  {
    symbol: "◇",
    title: ["Настройте карту под рейд", "Set up your raid map"],
    body: [
      "Откройте локацию, выберите этаж и оставьте только нужные метки. Разновидности контейнеров включаются отдельно. Приближайте колесом, перемещайте карту перетаскиванием.",
      "Open a location, choose a floor and keep only the markers you need. Container types can be toggled individually. Use the wheel to zoom and drag to pan.",
    ],
    tip: [
      "Фильтры и личные метки сохраняются для каждого режима и локации.",
      "Filters and personal markers are saved per game mode and location.",
    ],
  },
  {
    symbol: "✓",
    title: ["Открывайте задания прямо с карты", "Open quests from the map"],
    body: [
      "Нажмите на метку задания, чтобы увидеть цели, необходимые ключи и доступное прохождение. Поиск находит названия, предметы и текст инструкций.",
      "Click a quest marker to view objectives, required keys and the available walkthrough. Search finds quest names, items and instructions.",
    ],
    tip: [
      "Для заданий без подробного прохождения доступен краткий план по целям.",
      "Quests without a detailed walkthrough have a quick objective-based plan.",
    ],
  },
  {
    symbol: "⌁",
    title: ["Подключите GPS", "Connect GPS"],
    body: [
      "В разделе GPS проверьте папки скриншотов и логов. Автосъёмку включайте вручную перед рейдом. Она работает только при активном окне игры.",
      "Check screenshot and log folders in GPS settings. Enable auto capture manually before a raid. It runs only while the game window is active.",
    ],
    tip: [
      "Позиция определяется по новым скриншотам. Между снимками GPS не измеряет перемещение.",
      "Position comes from new screenshots. GPS does not measure movement between captures.",
    ],
  },
  {
    symbol: "↗",
    title: ["Сохраняйте свой прогресс", "Keep your progress"],
    body: [
      "Отмечайте выполненные задания, уровни убежища и собранные предметы. У PvP и PvE отдельный прогресс. В настройках можно сохранить резервную копию.",
      "Track completed quests, built hideout levels and collected items. PvP and PvE progress is separate. Save a backup from Settings.",
    ],
    tip: [
      "Очистка GPS удаляет только новые снимки сеанса автосъёмки. Старые скриншоты сохраняются.",
      "GPS cleanup deletes only new screenshots from the auto-capture session. Older screenshots are kept.",
    ],
  },
  {
    symbol: "?",
    title: ["Можно отправляться в рейд", "You are ready for your raid"],
    body: [
      "Ctrl+K открывает общий поиск, Esc закрывает карточку или сворачивает карту. Этот обзор, ответы на вопросы и список изменений доступны по кнопке «Помощь».",
      "Ctrl+K opens global search. Esc closes a detail view or collapses the map. Find this tour, FAQs and release notes under Help.",
    ],
    tip: [
      "В разделе поддержки можно узнать, как помочь развитию проекта. Общение, помощь и обсуждение обновлений доступны на нашем Discord-сервере.",
      "Visit Support to learn how to help fund development. Join our Discord server for community chat, help and update discussions.",
    ],
  },
];
export function hasSeenTour() {
  try {
    return JSON.parse(readWindowSetting(tourKey))?.completed === true;
  } catch {
    return false;
  }
}
export function openTour() {
  const dialog = document.querySelector("#modal");
  let step = 0;
  dialog.classList.add("tour-dialog");
  function render() {
    const item = steps[step];
    modal(
      `<div class="tour-header"><small>${esc(APP_TITLE)}</small><span>${step + 1} / ${steps.length}</span></div><div class="tour-art" aria-hidden="true"><span>${item.symbol}</span><i></i><i></i><i></i></div><h2>${esc(L(...item.title))}</h2><p class="tour-copy">${esc(L(...item.body))}</p><p class="tour-tip">${esc(L(...item.tip))}</p><div class="tour-dots" aria-label="${L("Этапы обзора", "Tour steps")}">${steps.map((_, i) => `<span class="${i === step ? "active" : ""}"></span>`).join("")}</div><div class="tour-actions"><button class="quiet" data-tour-skip>${L("Пропустить", "Skip")}</button><span></span><button data-tour-back ${step === 0 ? "disabled" : ""}>${L("Назад", "Back")}</button><button class="primary" data-tour-next>${step === steps.length - 1 ? L("Начать", "Let’s go") : L("Далее", "Next")}</button></div>`,
    );
    document.querySelector("[data-tour-skip]").onclick = () => dialog.close();
    document.querySelector("[data-tour-back]").onclick = () => {
      step = Math.max(0, step - 1);
      render();
    };
    document.querySelector("[data-tour-next]").onclick = () => {
      if (step === steps.length - 1) dialog.close();
      else {
        step++;
        render();
      }
    };
  }
  dialog.addEventListener(
    "close",
    () => {
      dialog.classList.remove("tour-dialog");
      writeWindowSetting(
        tourKey,
        JSON.stringify({ completed: true, version: 1 }),
      );
    },
    { once: true },
  );
  render();
}
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
