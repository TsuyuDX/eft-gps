import { localeCode } from "../core/localization.js";
import { esc, heading } from "../core/ui.js";
export const newsEntries = [
  {
    slug: "eft-gps-1-9",
    image: "/assets/news/app-maps.png",
    kind: "Приложение",
    date: "2026-10-30",
    label: "1.9.0",
    title: "EFT GPS 1.9.0: карты, прохождения и сообщество",
    summary:
      "Общий поиск, удобные панели карты, два стиля меток, обновляемые прохождения события и наш Discord.",
    paragraphs: [
      "Панели фильтров и заданий можно скрывать отдельно. Общий поиск помогает находить задания, предметы и точки карты. Доступны классические и новые цветные значки, подписи выходов и подсветка зон опасностей.",
      "Прохождения Хэллоуина 2026 проверяются при запуске и каждые 15 минут при открытом приложении. Новые инструкции и изображения сохраняются для работы без интернета. В карточке события есть ручная проверка.",
      "Новости получили превью, окна и кнопки стали удобнее, а Discord теперь доступен из верхней панели, помощи и поддержки. Личный прогресс и настройки сохраняются при обновлении.",
    ],
  },
  {
    slug: "eft-1-3-0-0",
    image: "/assets/news/eft-1-3.jpg",
    kind: "Игра",
    date: "2026-10-29",
    label: "1.3",
    title: "Патч 1.3.0.0: Хэллоуин и осень в Таркове",
    summary:
      "Зомби-событие, осенняя погода, новые сложные ЧВК-боты в PvE и изменения прокачки.",
    paragraphs: [
      "29 октября началось хэллоуинское событие. В приложении добавлен офлайн-справочник: четыре задания, условия, нужные предметы и иллюстрации. Откройте «События» или выберите фильтр «Хэллоуин 2026» в заданиях.",
      "Патч переключает погоду на осень и упрощает подбор части валюты и ценностей. На высокоуровневых PvE-локациях могут появляться более сложные ЧВК-боты. В Expansion Hub добавлены два комплекта оформления убежища.",
      "Изменена прокачка метаболизма, ускорено развитие навыков в сезонном режиме и увеличено время существования растяжек. Исправлены ошибки магазинов, оптики, ботов и геометрии локаций.",
      "Переход на Unity 6 не входит в этот патч: разработчики перенесли его на середину ноября, в обновление 1.3.5.0.",
    ],
    source: "https://steamcommunity.com/app/3932890/allnews/",
  },
  {
    slug: "eft-gps-1-7",
    image: "/assets/news/app-tour.png",
    kind: "Приложение",
    date: "2026-10-26",
    label: "1.7",
    title: "T_S_U_Y_U EFT GPS: новый этап",
    summary:
      "Английская база, первый обзор приложения и раздел помощи — в едином оформлении.",
    paragraphs: [
      "В версии 1.7.0 интерфейс, предметы, задания и сохранённые прохождения доступны на русском и английском. Язык приложения выбирается отдельно от языка установщика.",
      "Короткий обзор помогает настроить карты и GPS. В разделе «Помощь» доступны повтор обзора, FAQ, список изменений и шаблон отчёта об ошибке. Discord и поддержка проекта скоро будут доступны.",
    ],
  },
  {
    slug: "startup-1-6",
    image: "/assets/news/app-startup.png",
    kind: "Приложение",
    date: "2026-10-26",
    label: "1.6",
    title: "Подготовка к рейду начинается с запуска",
    summary:
      "Проверка базы и папок игры, выбор языка и тонкие полупрозрачные скроллбары в цвет интерфейса.",
    paragraphs: [
      "Новый экран подготовки проверяет компоненты и возможность сохранить прогресс. Папки скриншотов и логов ищутся в известных расположениях; при необходимости их можно выбрать вручную.",
      "Русский и English доступны для навигации и основных элементов управления. Игровые названия и сохранённые описания остаются на русском. На картах теперь используется название EFT GPS.",
    ],
  },
  {
    slug: "tarkov-gps-1-5",
    image: "/assets/news/app-overview.png",
    kind: "Приложение",
    date: "2026-10-26",
    label: "1.5",
    title: "Знакомьтесь: EFT GPS",
    summary:
      "Новое имя и единый стиль приложения: чёрная тема, песочные акценты и удобная навигация.",
    paragraphs: [
      "EFT GPS объединяет карты, задания, справочник предметов и подготовку к рейду в одном окне. Интерфейс и установщик теперь оформлены в одном стиле.",
      "Карты и сохранённый справочник доступны без интернета. Личные метки, выполненные задания, заметки и настройки сохраняются при обновлении.",
    ],
  },
  {
    slug: "gps-and-maps",
    image: "/assets/news/app-maps.png",
    kind: "Приложение",
    date: "2026-10-26",
    label: "GPS",
    title: "Карты и GPS для рейда",
    summary:
      "Чёткие карты, фильтры меток, этажи и зоны опасностей. GPS показывает последнюю определённую позицию.",
    paragraphs: [
      "На карте можно отдельно включать разновидности контейнеров, задания, выходы и опасности. Метки сохраняют удобный размер при приближении, а выбранный этаж выделяется на фоне остальных.",
      "GPS получает координаты из игровых скриншотов. Автосъёмка включается вручную и работает, когда активно окно игры. Без нового скриншота позиция не обновляется: время последнего определения видно на карте.",
      "При включённой очистке обработанные скриншоты сеанса автосъёмки удаляются. Старые файлы и снимки вне этого сеанса сохраняются.",
    ],
  },
  {
    slug: "quests-and-settings",
    image: "/assets/news/app-quests.png",
    kind: "Приложение",
    date: "2026-10-26",
    label: "01",
    title: "Всё нужное — перед рейдом",
    summary:
      "Поиск заданий и предметов, прохождения, личный прогресс и настройки карты в одном месте.",
    paragraphs: [
      "Откройте задание из списка или с карты, чтобы посмотреть цели, ключи и доступные иллюстрации. Если подробного прохождения нет, показывается краткий план по целям задания.",
      "Ctrl+K открывает общий поиск. Esc возвращает из карточки или сворачивает карту. В настройках можно скрыть лишние элементы интерфейса; выбор слоёв карты запоминается отдельно для каждой локации.",
    ],
  },
  {
    slug: "eft-leagues-survey",
    image: "/assets/news/eft-survey.png",
    kind: "Игра",
    date: "2026-10-16",
    label: "EFT",
    title: "Разработчики собирают отзывы о Лигах",
    summary:
      "Battlestate Games объявила внутриигровой опрос о соревнованиях и системе рангов.",
    paragraphs: [
      "16 октября разработчики предложили игрокам оценить Лиги: недельные соревнования, изменение ранга, таблицы результатов и награды. Обратная связь поможет определить дальнейшие изменения системы.",
    ],
    source: "https://steamcommunity.com/app/3932890/announcements/?l=russian",
  },
  {
    slug: "eft-1-2-0-0",
    image: "/assets/news/eft-1-2.jpg",
    kind: "Игра",
    date: "2026-10-06",
    label: "1.2",
    title: "Escape from Tarkov: обновление 1.2.0.0",
    summary:
      "Престиж в PvE, программа для совместной игры опытных игроков с новичками и изменения поведения ботов.",
    paragraphs: [
      "В официальном описании патча представлены Престиж для PvE и программа «Боевое слаживание». Изменены отношения фракций ботов и их перемещение; внесены исправления локаций и улучшения сетевой синхронизации.",
      "Это краткий обзор объявления разработчиков. Подробные условия, награды и полный перечень изменений доступны в оригинальной публикации.",
    ],
    source: "https://steamcommunity.com/app/3932890/announcements/?l=russian",
  },
];
export function newsPreview(entry) {
  const source = /^\/assets\/news\/[a-zA-Z0-9.-]+$/.test(entry.image || "")
    ? entry.image
    : "/assets/news/app-overview.png";
  return `<div class="news-preview"><img src="${esc(source)}" alt="" loading="lazy" width="960" height="540"><span class="news-kind">${esc(entry.kind)}</span><span class="news-version">${esc(entry.label)}</span></div>`;
}
export const newsCards = (entries = newsEntries) =>
  entries
    .map(
      (x) =>
        `<a class="card news-card" href="#/news/${x.slug}">${newsPreview(x)}<div class="card-body"><small class="news-date">${new Date(x.date + "T12:00:00").toLocaleDateString(localeCode())}</small><h3>${esc(x.title)}</h3><p class="muted">${esc(x.summary)}</p><span class="read-more">Подробнее ↗</span></div></a>`,
    )
    .join("");
export function renderNews(root, slug) {
  if (!slug) {
    root.innerHTML =
      heading("Новости", "Изменения EFT GPS и официальные объявления об игре") +
      `<div class="toolbar news-filters"><button data-news-filter="Все" class="primary">Все</button><button data-news-filter="Приложение">Приложение</button><button data-news-filter="Игра">Игра</button></div><div class="card-grid news-grid" id="news-list">${newsCards()}</div>`;
    root.querySelectorAll("[data-news-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          root
            .querySelectorAll("[data-news-filter]")
            .forEach((x) => x.classList.toggle("primary", x === b));
          root.querySelector("#news-list").innerHTML = newsCards(
            newsEntries.filter(
              (x) =>
                b.dataset.newsFilter === "Все" ||
                x.kind === b.dataset.newsFilter,
            ),
          );
        }),
    );
    return;
  }
  const entry = newsEntries.find((x) => x.slug === slug);
  if (!entry) {
    root.innerHTML =
      heading("Новость недоступна") +
      '<p>Этой записи нет в текущей ленте.</p><a class="button" href="#/news">Все новости</a>';
    return;
  }
  root.innerHTML =
    heading(
      entry.title,
      `${entry.kind} · ${new Date(entry.date + "T12:00:00").toLocaleDateString(localeCode())}`,
    ) +
    `<article class="news-detail" data-selectable><figure class="news-hero">${newsPreview(entry)}<figcaption class="small muted">${entry.kind === "Игра" ? "Иллюстрация Battlestate Games" : "Интерфейс EFT GPS · иллюстрация возможностей приложения"}</figcaption></figure><p class="news-lead">${esc(entry.summary)}</p>${entry.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}${entry.source ? `<div class="official-source"><strong>Battlestate Games</strong><p>Официальное объявление разработчиков. Для открытия публикации нужен интернет.</p><a class="button" href="${esc(entry.source)}" target="_blank" rel="noopener">Читать оригинал ↗</a></div>` : ""}</article>`;
}
