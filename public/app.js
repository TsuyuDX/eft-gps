import {textPair} from "./core/localization.js";
import { initializeGameInfo, startGameInfo } from "./core/game-info-client.js";
import { renderHomeInformation, renderInformation, renderPromocodes, bindSeasonStatus } from "./features/game-info.js";
import { renderGraphics } from "./features/graphics.js";
import { uiIcon } from "./core/icons.js";
import { startConnectivityStatus } from "./core/connectivity.js";
import { refreshQuestList } from "./features/quests.js";
import { initializeOverlay } from "./core/overlay-client.js";
import { bindGlobalSearch, openGlobalSearch } from "./core/global-search.js";
import { ViewCache } from "./core/view-cache.js";
import { refreshCatalog } from "./features/catalog.js";
import { overlayMode } from "./core/overlay-mode.js";
import { supportUrl } from "./core/support-config.js";
import {
  refreshEventContent,
  startEventContent,
} from "./core/event-content-client.js";
import { clearEventContentCache } from "./core/data.js";
import { startAppUpdates } from "./core/app-update.js";
import { localeCode } from "./core/localization.js";
import { APP_TITLE, APP_VERSION } from "./core/brand.js";
import { openHelp, maybeShowTour } from "./features/help.js";
import { openSupport } from "./features/support.js";
import { language, t } from "./core/localization.js";
import { prepareStartup, finishStartup, startupError } from "./core/startup.js";
import { newsCards, newsEntries, renderNews, refreshGameNews } from "./features/news.js";
import { loadWindowSettings } from "./core/window-settings.js";
import { applyPreferences, openPreferences } from "./core/preferences.js";
import {
  addBackButton,
  installBackNavigation,
} from "./core/back-navigation.js";
import { db, init, loadMode, asset, json } from "./core/data.js";
import { loadState, profile, setMode, current } from "./core/state.js";
import { esc, heading, img, toast, errorView } from "./core/ui.js";
import { renderCatalog, renderItem } from "./features/catalog.js";
import { renderQuests, renderQuest } from "./features/quests.js";
import { renderMaps, renderMap } from "./features/maps.js";
import {
  renderTracker,
  renderHideout,
  renderModifiers,
  renderSettings,
} from "./features/progress.js";
import { renderArticle, renderArticleList } from "./features/articles.js";
import { renderGps } from "./features/gps.js";
import { startGpsClient } from "./core/gps-client.js";
import { installAppNavigation } from "./core/navigation.js";
import { installDesktopUi } from "./core/desktop-ui.js";
document.title = APP_TITLE;
document
  .querySelectorAll(".brand-version, .boot-version")
  .forEach((element) => {
    element.textContent = APP_VERSION;
  });
const communityLink = document.querySelector("#discord-link");
const communityUrl = supportUrl("discord");
if (communityLink && communityUrl) {
  communityLink.href = communityUrl;
  communityLink.hidden = false;
}
installAppNavigation();
installDesktopUi();
installBackNavigation();
const modeSelect=document.querySelector("#mode"),modeEmblem=document.createElement("span");
modeEmblem.className="mode-emblem";modeEmblem.setAttribute("aria-hidden","true");modeSelect.before(modeEmblem);
for(const option of modeSelect.options)option.textContent=option.value==="pve"?"PvE":"PvP";
const drawModeEmblem=()=>modeEmblem.innerHTML=uiIcon(modeSelect.value==="pve"?"pve":"pvp",18);
modeSelect.addEventListener("change",drawModeEmblem);window.addEventListener("language-changed",drawModeEmblem);

await loadWindowSettings();
applyPreferences();
const app = document.querySelector("#app"),
  navigation = document.querySelector("#navigation");
let routeVersion = 0;
const viewCache = new ViewCache();
window.addEventListener("game-info-updated",()=>{
 refreshGameNews();
 const homeNews=app.querySelector(".home-news .news-grid");if(homeNews)homeNews.innerHTML=newsCards(newsEntries.slice(0,4));
 const list=app.querySelector("#news-list");if(list){const filter=app.querySelector("[data-news-filter].primary")?.dataset.newsFilter||"Все";list.innerHTML=newsCards(newsEntries.filter(x=>filter==="Все"||x.kind===filter));}
});
window.addEventListener("language-changed",refreshGameNews);
let activeView = null;
const viewKey = () => db.mode + ":" + language() + ":" + (location.hash || "#/");
const sections = [
  ["map", "Карты"],
  ["gps", "GPS"],
  ["quest", "Задания"],
  ["item", "Предметы"],
  ["items-tracker", "Мой прогресс"],
  ["hideout", "Убежище"],
  ["trader", "Торговцы"],
  ["boss", "Боссы"],
  ["event", "События"],
  ["promocodes", "Промокоды"],
  ["season", "Сезоны"],
  ["news", "Новости"],
  ["graphics", "Цветокоррекция"],
];

function nav() {
  navigation.innerHTML = sections
    .map(
      ([k, v]) =>
        `<a href="#/${k}/${["map", "boss", "trader", "item", "quest", "hideout", "items-tracker"].includes(k) ? db.mode : ""}" data-section="${k}" class="${["promocodes","graphics"].includes(k)?"nav-has-new":""}"><span>${v}</span>${["promocodes","graphics"].includes(k)?`<span class="nav-new-badge" aria-hidden="true" data-no-translate>${textPair("НОВОЕ","NEW")}</span>`:""}</a>`,
    )
    .join("");
}
function home() {
  const completed = Object.values(current().quests).filter(Boolean).length;
  app.innerHTML = `<section class="home-hero"><div class="eyebrow">НАВИГАЦИЯ / ПОДГОТОВКА / РЕЙД</div><h1>EFT <span>GPS</span></h1><div class="badge home-version" data-no-translate>${textPair("Версия","Version")} ${APP_VERSION}</div><p>Всё для следующего рейда. Карты, GPS, задания и личный прогресс.</p><div class="row wrap home-actions"><a class="button primary" href="#/map/${db.mode}">Открыть карты ↗</a><a class="button" href="#/gps">Настроить GPS</a></div><div class="home-search"><span>⌕</span><input type="search" id="global-search" placeholder="Найти предметы, задания, модули убежища" autocomplete="off"><kbd>Ctrl K</kbd></div><div id="global-results" class="global-results" hidden></div></section><div class="dashboard-strip"><a href="#/map/${db.mode}"><b>${db.maps.length}</b> карт</a><a href="#/item/${db.mode}"><b>${db.items.length.toLocaleString(localeCode())}</b> предметов</a><a href="#/quest/${db.mode}"><b>${completed} / ${db.quests.length}</b> заданий</a><a href="#/items-tracker/${db.mode}"><b>Мой прогресс</b> →</a></div><div id="home-information"></div><section class="home-news"><h2 class="center">Новости приложения и игры</h2><div class="card-grid news-grid">${newsCards(newsEntries.slice(0, 4))}</div><p class="center" style="margin-top:24px"><a class="button" href="#/news">Все новости →</a></p></section>`;
  renderHomeInformation(app.querySelector("#home-information"));
  bindGlobalSearch(app.querySelector("#global-search"), app.querySelector("#global-results"), newsEntries);
}
async function route() {
  if (activeView) viewCache.save(activeView.key, app, {cache: activeView.catalog});
  activeView = null;
  window.dispatchEvent(new Event("view-changing"));
  const version = ++routeVersion;
  const path = decodeURIComponent(location.hash.slice(2).split("?")[0]).replace(
    /\/$/,
    "",
  );
  const [section, modeOrSlug, slug] = path.split("/");
  document.querySelector("#modal").close();
  navigation.classList.remove("expanded");
  navigation
    .querySelectorAll("a")
    .forEach((e) =>
      e.classList.toggle("active", e.dataset.section === section),
    );
  app.classList.toggle("wide", section === "map" && !!slug);
  app.innerHTML = '<div class="empty">Загрузка…</div>';
  try {
    if (["regular", "pve"].includes(modeOrSlug) && modeOrSlug !== db.mode) {
      await loadMode(modeOrSlug);
      setMode(modeOrSlug, {persist: !overlayMode});
      document.querySelector("#mode").value = db.mode;
      drawModeEmblem();
      nav();
    }
    if (version !== routeVersion) return;
    const cacheKey = viewKey();
    const restored = viewCache.restore(cacheKey, app);
    if (restored) {refreshCatalog(app);refreshQuestList(app);}
    else switch (section) {
      case "item":
        slug ? await renderItem(app, slug) : renderCatalog(app);
        break;
      case "quest":
        slug ? await renderQuest(app, slug) : await renderQuests(app);
        break;
      case "map":
        slug ? await renderMap(app, slug) : renderMaps(app);
        break;
      case "hideout":
        slug ? await renderArticle(app, path) : renderHideout(app);
        break;
      case "items-tracker":
        renderTracker(app);
        break;
      case "modifiers":
        renderModifiers(app);
        break;
      case "settings":
        await renderSettings(app);
        break;
      case "intel":
        renderInformation(app, modeOrSlug);
        break;
      case "promocodes":
        renderPromocodes(app);
        break;
      case "graphics":
        await renderGraphics(app);
        break;
      case "gps":
        await renderGps(app);
        break;
      case "news":
        renderNews(app, slug || modeOrSlug);
        break;
      case "event-archive":
        renderArticleList(app,"event");
        break;
      case "event":
        if(modeOrSlug)await renderArticle(app,path);else renderInformation(app);
        break;
      case "boss":
      case "trader":
      case "season":
        slug || (modeOrSlug && !["regular", "pve"].includes(modeOrSlug))
          ? await renderArticle(app, path)
          : renderArticleList(app, section);
        break;
      default:
        home();
    }
    if (version !== routeVersion) return;
    if (!restored) addBackButton(app);
    activeView = {key: cacheKey, catalog: ["item","quest"].includes(section) && !slug};
    const position = section ? viewCache.position(cacheKey) : {top:0,left:0};
    app.scrollTop = position.top; app.scrollLeft = position.left;
    requestAnimationFrame(() => {if (version === routeVersion) {app.scrollTop=position.top;app.scrollLeft=position.left;}});
  } catch (e) {
    if (version === routeVersion) app.innerHTML = errorView(e);
  }
}
// Start the home view at the top after maximize/restore instead of retaining a clipped hero.
let homeResizeTimer, settledWidth=window.innerWidth, settledHeight=window.innerHeight;
window.addEventListener("resize",()=>{
  clearTimeout(homeResizeTimer);
  homeResizeTimer=setTimeout(()=>{
    const changed=Math.abs(window.innerWidth-settledWidth)>=120 || Math.abs(window.innerHeight-settledHeight)>=100;
    settledWidth=window.innerWidth;settledHeight=window.innerHeight;
    if(changed && app.querySelector(":scope > .home-hero"))app.scrollTop=0;
  },120);
});
document.querySelector("#modal .close").onclick = () =>
  document.querySelector("#modal").close();
document.querySelector("#modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
document.querySelector("#menu").onclick = () =>
  navigation.classList.toggle("expanded");
document.querySelector("#settings-link").onclick = openPreferences;
const searchButton=document.createElement("button");searchButton.id="app-search-open";searchButton.textContent="⌕ Поиск";searchButton.title="Ctrl+K";searchButton.onclick=()=>openGlobalSearch(newsEntries);document.querySelector("#settings-link").before(searchButton);
document.querySelector("#help-link").onclick = openHelp;
document.querySelector("#support-link").onclick = () => openSupport();
window.addEventListener("save-failed", () =>
  toast(
    "Не удалось записать файл. Прогресс остаётся в окне; сохраните резервную копию.",
  ),
);
try {
  const startupResult = await prepareStartup();
  document.querySelector("#boot-stage").textContent =
    "Открываем интерфейс и личный профиль…";
  await loadState();
  await refreshEventContent();
  await init(profile().mode);
  if(!overlayMode) {await initializeGameInfo();const seasonStatus=document.createElement("a");seasonStatus.id="season-status";seasonStatus.className="season-header-status";seasonStatus.hidden=true;document.querySelector(".statusline").insertBefore(seasonStatus,document.querySelector(".statusline").lastElementChild);const eventStatus=document.createElement("a");eventStatus.id="event-status";eventStatus.className="season-header-status event-header-status";eventStatus.hidden=true;seasonStatus.after(eventStatus);bindSeasonStatus(seasonStatus,eventStatus);}
  refreshGameNews();
  document.querySelector("#mode").value = db.mode;
      drawModeEmblem();
  document.querySelector("#logo").src = "/icons/app-192.png";
  renderSnapshotDate();
  nav();
  document.querySelector("#mode").onchange = async (e) => {
    await loadMode(e.target.value);
    setMode(e.target.value, {persist: !overlayMode});
    nav();
    const hash = location.hash.replace(
      /\/(regular|pve)(\/|$)/,
      "/" + db.mode + "$2",
    );
    if (hash !== location.hash) location.hash = hash;
    else route();
  };
  window.addEventListener("hashchange", route);
  await route();
  await finishStartup(startupResult);
  startGpsClient(() => db.mode);
  if (!overlayMode) { maybeShowTour(); startAppUpdates(); startConnectivityStatus(); void initializeOverlay(); }
  if(!overlayMode) startGameInfo();
  startEventContent(async () => {
    clearEventContentCache();
    await loadMode(db.mode);
    if (
      /^#\/(quest|event)(\/|$)/.test(location.hash) &&
      !document.querySelector("dialog[open]") &&
      !document.activeElement?.matches(
        "input,select,textarea,[contenteditable]",
      )
    )
      await route();
    toast(t("Прохождения события обновлены"));
  });
} catch (e) {
  startupError(e);
  app.innerHTML = errorView(e);
}
let languageChangeVersion = 0;
window.addEventListener("language-changed", async () => {
  const change = ++languageChangeVersion;
  const preferencesOpen = document.querySelector(
    "#modal[open] #preferences-controls",
  );
  const selectedTab =
    document.querySelector('[data-preference-tab][aria-pressed="true"]')
      ?.dataset.preferenceTab || "Интерфейс";
  app.innerHTML = '<div class="empty">' + t("Загрузка…") + "</div>";
  try {
    const ready = await init(profile().mode);
    if (!ready || change !== languageChangeVersion) return;
    renderSnapshotDate();
    nav();
    const reopenPreferences=preferencesOpen?.isConnected && document.querySelector("#modal").open;
    await route();
    if (reopenPreferences) openPreferences(selectedTab);
  } catch (error) {
    app.innerHTML = errorView(error);
  }
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openGlobalSearch(newsEntries);
  }
});
function renderSnapshotDate() {
  const element=document.querySelector("#snapshot-date");
  element.innerHTML=uiIcon("calendar",16)+"<span>"+esc(t("Снимок")+" "+new Date(db.manifest.savedAt).toLocaleDateString(localeCode()))+"</span>";
  element.title=t("Дата сохранения справочника в верхней панели.");
}
function clock() {
  const elapsed = Date.now() / 1000,
    seconds = Math.floor((elapsed * 7 + 10800) % 86400),
    hours = Math.floor(seconds / 3600),
    mins = Math.floor((seconds % 3600) / 60);
  const time = document.querySelector("#raid-time");
  const day=String(hours).padStart(2,"0")+":"+String(mins).padStart(2,"0"),night=String((hours+12)%24).padStart(2,"0")+":"+String(mins).padStart(2,"0");
  time.innerHTML='<span class="raid-clock-day">'+uiIcon("sun",16)+'<span>'+day+'</span></span><span class="raid-clock-night">'+uiIcon("moon",15)+'<span>'+night+'</span></span>';
  time.title=t("Время в Таркове");

}
clock();
setInterval(clock, 10000);
setInterval(() => fetch("/api/health").catch(() => {}), 20000);
