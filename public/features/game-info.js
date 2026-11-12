import {textPair} from "../core/localization.js";
import {gameArtwork} from "../core/news-artwork.js";
import {
  gameInfo,
  gameInfoState,
  refreshGameInfo,
} from "../core/game-info-client.js";
import {
  recordState,
  promoGroup,
  seasonRemaining,
  activeSeason,
} from "../core/game-info-model.js";
import { language, localeCode } from "../core/localization.js";
import { heading, esc, toast } from "../core/ui.js";
import { uiIcon } from "../core/icons.js";
const tr = textPair;
const value = (x) => x?.[language()] || x?.en || x?.ru || "";
const date = (x) =>
  x
    ? (x.length===10?new Date(x+"T12:00:00Z").toLocaleDateString(localeCode()):new Date(x).toLocaleString(localeCode()))
    : tr("Не объявлена", "Not announced");
export function modeChip(mode) {
  return `<span class="info-mode">${uiIcon(mode, 16)}${{ pvp: "PvP", pve: "PvE", season: "PvP Season" }[mode] || ""}</span>`;
}
function badge(item) {
  const state = recordState(item);
  if(item.type==="event" && state==="unconfirmed")return `<span class="badge">${tr("Активность не подтверждена","Activity unconfirmed")}</span>`;
  return `<span class="badge info-verification">${state === "archived" ? tr("Архив", "Archived") : item.type === "promo" ? (item.activationVerified ? tr("Активация проверена", "Redemption verified") : tr("Не проверен", "Unverified")) : item.verified === "official" ? tr("Официальный источник", "Official source") : item.verified === "reviewed" ? tr("Проверено редактором", "Reviewed") : tr("Требует проверки", "Needs review")}</span>`;
}
function source(item) {
  return `<p class="muted small">${tr("Проверка записи", "Record checked")}: ${date(item.checkedAt)} · <a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">${tr("Первоисточник", "Source")} ↗</a></p>`;
}
function card(item) {
  const state = recordState(item);
  return `<a class="card info-card ${item.type==="season"?"info-card-season":""} ${state === "active" ? "info-card-active" : ""}" href="#/intel/${item.id}">${(item.type==="season"||item.image||item.imageRemote) ? `<figure><img src="${gameArtwork(item)}" alt="" loading="lazy"><figcaption>${tr("Иллюстрация Battlestate Games", "Artwork by Battlestate Games")}</figcaption></figure>` : ""}<div class="card-body">${badge(item)}<h3>${esc(value(item.title))}</h3><p>${esc(value(item.description))}</p><p class="muted small">${tr("Начало", "Start")}: ${date(item.startsAt)} · ${tr("Завершение", "End")}: ${date(item.endsAt || item.endsOn)}</p><span>${tr("Подробнее →", "Details →")}</span></div></a>`;
}
export function renderHomeInformation(root) {
  const draw = () => {
    const data = gameInfo(),
      seasons = data.records
        .filter(
          (x) =>
            x.type === "season" &&
            x.verified !== "unverified" &&
            recordState(x) !== "archived",
        )
        .sort((a, b) => (b.startsAt || "").localeCompare(a.startsAt || "")),
      season = seasons[0],
      events = data.records.filter(
        (x) => x.type === "event" && recordState(x) === "active",
      ),
      remaining = season && seasonRemaining(season);
    root.innerHTML = `<div class="info-home" data-no-translate><section><h2>${tr("Текущий сезон", "Current season")}</h2>${season ? `<div class="info-season-line">${modeChip("season")}<strong>${esc(value(season.title))}</strong><span>${tr("До завершения", "Until the end")}: ${remaining ? `${remaining.days} ${tr("дн.", "days")} ${remaining.hours} ${tr("ч.", "hours")}` : tr("точное время не объявлено", "exact time not announced")}</span></div>${card(season)}` : `<p class="muted">${tr("Текущий сезон не подтверждён.", "The current season has not been confirmed.")}</p>`}</section><section><h2>${tr("Активные события", "Active events")}</h2>${events.length ? events.map(card).join("") : `<div class="panel"><p>${tr("В данный момент активных событий нет", "There are no active events at the moment")}</p><p class="muted small">${tr("Здесь появляются только события с подтверждённой текущей активностью. Если подтверждение устарело, запись остаётся в справочнике.", "Only events with confirmed current activity appear here. When confirmation becomes stale, the record remains in the reference section.")}</p><a href="#/intel">${tr("Все события и источники →", "All events and sources →")}</a></div>`}</section></div>`;
  };
  draw();
  const controller = new AbortController();
  window.addEventListener("game-info-updated", draw, {
    signal: controller.signal,
  });
  const timer = setInterval(draw, 60000);
  window.addEventListener(
    "view-changing",
    () => {
      clearInterval(timer);
      controller.abort();
    },
    { once: true, signal: controller.signal },
  );
}
export function renderInformation(root, id) {
  const controller = new AbortController(),
    signal = controller.signal;
  window.addEventListener("view-changing", () => controller.abort(), {
    once: true,
    signal,
  });
  function draw() {
    const data = gameInfo(),
      item = data.records.find((x) => x.id === id),
      state = gameInfoState();
    if (item) {
      root.innerHTML = `<section class="info-detail" data-no-translate>${heading(value(item.title))}${badge(item)}<p class="info-lead">${esc(value(item.description))}</p>${source(item)}${item.activitySource?`<p class="muted small"><a href="${esc(item.activitySource)}" target="_blank" rel="noopener noreferrer">${tr("Подтверждение срока или активности","Date or activity evidence")} ↗</a></p>`:""}<div class="row wrap">${item.modes.map(modeChip).join("")}</div><p>${tr("Начало", "Start")}: ${date(item.startsAt)} · ${tr("Завершение", "End")}: ${date(item.endsAt || item.endsOn)}</p>${item.type === "season" && !seasonRemaining(item) ? `<p class="muted">${tr("Час окончания не подтверждён. Обратный отсчёт не запускается.", "The end time is unconfirmed. No countdown is shown.")}</p>` : ""}${(item.image||item.imageRemote||item.type==="season") ? `<figure><img class="guide-image" src="${gameArtwork(item)}" alt=""><figcaption class="muted small">${tr("Иллюстрация Battlestate Games", "Artwork by Battlestate Games")}</figcaption></figure>` : ""}${item.steps.length ? `<h2>${tr("Как участвовать", "How to take part")}</h2><ol>${item.steps.map((x) => `<li>${esc(value(x))}</li>`).join("")}</ol>` : ""}${item.rewards.length ? `<h2>${tr("Награды и условия", "Rewards and conditions")}</h2><div class="info-rewards">${item.rewards.map((x) => `<article class="panel"><h3>${esc(value(x.title))}</h3><span class="badge">${x.verified === "official" ? tr("Официально подтверждено", "Officially confirmed") : tr("Не подтверждено · не гарантируется", "Unconfirmed · not guaranteed")}</span><p>${esc(value(x.description))}</p><a href="${esc(x.source)}" target="_blank" rel="noopener noreferrer">${tr("Источник", "Source")} ↗</a></article>`).join("")}</div>` : ""}${item.guide ? `<p><a class="button primary" href="${item.guide}">${tr("Задания, иллюстрации и прохождение →", "Tasks, illustrations and walkthrough →")}</a></p>` : ""}<p><a class="button" href="#/intel">${tr("← Все события и сезоны", "← All events and seasons")}</a></p></section>`;
      return;
    }
    root.innerHTML = `<section data-no-translate>${heading(tr("События, сезоны и источники", "Events, seasons and sources"))}<div class="info-sync panel"><p>${tr("Последнее успешное получение лент", "Last successful feed retrieval")}: ${date(state.lastSuccess || data.lastSuccess)} · ${state.phase === "offline" ? tr("Нет связи · сохранённые данные", "Offline · saved data") : tr("Сохранённая информация", "Saved information")}</p><button id="info-refresh">${tr("Проверить сейчас", "Check now")}</button></div><p class="muted">${tr("Получение ленты не подтверждает активацию промокода или текущую активность события. Такие факты проверяются отдельно.", "Retrieving a feed does not verify code redemption or current event activity. These facts are checked separately.")}</p><p><a class="button" href="#/event-archive">${tr("Сохранённые события и архив →","Saved events and archive →")}</a></p><h2>${tr("События и сезоны", "Events and seasons")}</h2><div class="card-grid">${data.records
      .filter((x) => ["event", "season"].includes(x.type))
      .map(card)
      .join(
        "",
      )}</div><h2>${tr("Источники и ограничения", "Sources and limitations")}</h2><div class="info-sources">${data.sources.map((x) => `<article class="panel"><h3><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name)}</a></h3><span class="badge">${{ connected: tr("Подключён", "Connected"), unavailable: tr("Недоступен", "Unavailable"), "requires-auth": tr("Нужен доступ к API", "API access required"), "review-only": tr("Требует проверки", "Needs review") }[x.status]}</span><p>${esc(value(x.reason))}</p><small class="muted">${date(x.checkedAt)}</small></article>`).join("")}</div></section>`;
    root.querySelector("#info-refresh").onclick = async () => {
      const button = root.querySelector("#info-refresh");
      button.disabled = true;
      try {
        await fetch("/api/game-info/check", { method: "POST", signal });
        await refreshGameInfo();
      } catch {
        toast(
          tr(
            "Сохранённые данные остаются доступны.",
            "Saved data remains available.",
          ),
        );
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    };
  }
  draw();
  window.addEventListener("game-info-updated", draw, { signal });
}
export function renderPromocodes(root) {
  let mode = "all";
  const controller = new AbortController(),
    signal = controller.signal;
  window.addEventListener("view-changing", () => controller.abort(), {
    once: true,
    signal,
  });
  function draw() {
    const data = gameInfo(),
      codes = data.records.filter(
        (x) =>
          x.type === "promo" &&
          (mode === "all" ||
            (mode === "unknown" ? !x.modes.length : x.modes.includes(mode))),
      );
    root.innerHTML = `<section class="promo-page" data-no-translate>${heading(tr("Промокоды", "Promo codes"), tr("Активация проверяется отдельно от факта публикации кода.", "Redemption is verified separately from the fact that a code was published."))}<div class="row wrap info-mode-filters">${[
      ["all", tr("Все", "All")],
      ["pvp", "PvP"],
      ["pve", "PvE"],
      ["season", "PvP Season"],
      ["unknown", tr("Режим не подтверждён", "Mode unconfirmed")],
    ]
      .map(
        ([k, label]) =>
          `<button data-promo-mode="${k}" aria-pressed="${mode === k}" class="${mode === k ? "primary" : ""}">${["pvp", "pve", "season"].includes(k) ? uiIcon(k, 18) : ""}${label}</button>`,
      )
      .join(
        "",
      )}</div><p class="muted">${tr("Публикация не гарантирует работоспособность. Коды вводятся только в официальном лаунчере или на сайте Escape from Tarkov. Приложение не запрашивает пароль от игры.", "Publication does not guarantee redemption. Redeem codes only in the official launcher or Escape from Tarkov website. This application never asks for your game password.")}</p>${[
      ["permanent", tr("Постоянные промокоды", "Permanent codes")],
      [
        "temporary",
        tr("Временные и с неизвестным сроком", "Temporary and unknown expiry"),
      ],
      ["archive", tr("Архив", "Archive")],
    ]
      .map(
        ([group, title]) =>
          `<section><h2>${title}</h2>${
            codes
              .filter((x) => promoGroup(x) === group)
              .map(
                (x) =>
                  `<article class="panel promo-card"><div class="row wrap"><code data-selectable>${esc(x.code)}</code>${badge(x)}<button data-copy-code="${x.code}">${tr("Копировать", "Copy")}</button></div><p>${esc(value(x.description))}</p><div class="row wrap">${x.modes.length ? x.modes.map(modeChip).join("") : `<span class="muted">${tr("Применимость к режимам не подтверждена", "Mode eligibility unconfirmed")}</span>`}</div><p>${x.endsAt ? tr("До", "Until") + " " + date(x.endsAt) : x.permanentConfirmed ? tr("Бессрочность подтверждена источником", "No-expiry status confirmed by the source") : tr("Срок действия не подтверждён", "Expiry date unconfirmed")}</p>${source(x)}</article>`,
              )
              .join("") ||
            `<p class="empty">${group === "permanent" ? tr("Коды с подтверждённой бессрочностью не найдены.", "No codes with confirmed permanent validity have been found.") : tr("В этой категории пока нет записей.", "No records in this category yet.")}</p>`
          }</section>`,
      )
      .join(
        "",
      )}<p><a class="button" href="#/intel">${tr("Источники и состояние обновления →", "Sources and update status →")}</a></p></section>`;
    root.querySelectorAll("[data-promo-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          mode = b.dataset.promoMode;
          draw();
        }),
    );
    root.querySelectorAll("[data-copy-code]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await navigator.clipboard.writeText(b.dataset.copyCode);
            toast(tr("Промокод скопирован", "Code copied"));
          } catch {
            toast(
              tr(
                "Не удалось скопировать. Выделите код вручную.",
                "Could not copy. Select the code manually.",
              ),
            );
          }
        }),
    );
  }
  draw();
  window.addEventListener("game-info-updated", draw, { signal });
}

export function bindSeasonStatus(root,eventRoot){
 const draw=()=>{const records=gameInfo().records,season=activeSeason(records);if(eventRoot){const event=records.find(x=>x.id==="halloween-2026");eventRoot.hidden=!event;if(event){const state=recordState(event);eventRoot.href="#/intel/"+event.id;eventRoot.classList.toggle("event-status-active",state==="active");eventRoot.innerHTML=`<i aria-hidden="true"></i><span>${tr("Хэллоуин","Halloween")} · ${state==="active"?tr("активен","active"):state==="archived"?tr("завершён","ended"):tr("статус уточняется","status unconfirmed")}</span>`;eventRoot.title=state==="active"?tr("Открыть событие и задания","View the event and quests"):tr("Текущая активность игровых заданий не подтверждена свежим официальным сообщением","Current quest activity has not been confirmed by a recent official announcement");}}root.hidden=!season;if(!season){root.replaceChildren();return;}root.href="#/intel/"+season.id;root.innerHTML=`<i aria-hidden="true"></i><span>${tr("Сезон активен","Season active")}: <strong>${esc(value(season.title).split(" · ")[0])}</strong></span>`;root.title=tr("Открыть информацию о текущем сезоне","View the current season");};
 draw();window.addEventListener("game-info-updated",draw);window.addEventListener("language-changed",draw);setInterval(draw,60000);
}
