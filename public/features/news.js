import { esc, heading } from "../core/ui.js";
export const newsEntries = [
  {
    slug: "tarkov-gps-1-5",
    kind: "Приложение",
    date: "2026-10-26",
    label: "1.5",
    title: "Знакомьтесь: Тарков GPS",
    summary:
      "Новое имя и единый стиль приложения: чёрная тема, песочные акценты и удобная навигация.",
    paragraphs: [
      "Тарков GPS объединяет карты, задания, справочник предметов и подготовку к рейду в одном окне. Интерфейс и установщик теперь оформлены в одном стиле.",
      "Карты и сохранённый справочник доступны без интернета. Личные метки, выполненные задания, заметки и настройки сохраняются при обновлении.",
    ],
  },
  {
    slug: "gps-and-maps",
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
export const newsCards = (entries = newsEntries) =>
  entries
    .map(
      (x) =>
        `<a class="card news-card" href="#/news/${x.slug}"><div class="news-visual"><span>${esc(x.kind)}</span><strong>${esc(x.label)}</strong><img src="/icons/app-192.png" alt="" aria-hidden="true"></div><div class="card-body"><small class="news-date">${new Date(x.date + "T12:00:00").toLocaleDateString("ru-RU")}</small><h3>${esc(x.title)}</h3><p class="muted">${esc(x.summary)}</p><span class="read-more">Подробнее ↗</span></div></a>`,
    )
    .join("");
export function renderNews(root, slug) {
  if (!slug) {
    root.innerHTML =
      heading(
        "Новости",
        "Изменения Тарков GPS и официальные объявления об игре",
      ) +
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
      `${entry.kind} · ${new Date(entry.date + "T12:00:00").toLocaleDateString("ru-RU")}`,
    ) +
    `<article class="news-detail" data-selectable><p class="news-lead">${esc(entry.summary)}</p>${entry.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}${entry.source ? `<div class="official-source"><strong>Battlestate Games</strong><p>Официальное объявление разработчиков. Для открытия публикации нужен интернет.</p><a class="button" href="${esc(entry.source)}" target="_blank" rel="noopener">Читать оригинал ↗</a></div>` : ""}</article>`;
}
