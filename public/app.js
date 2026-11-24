import {initializeItemRecognition} from "./core/item-recognition-client.js";
import {renderRaidHome, installShell} from "./core/raid-shell.js";
import {installDiagnostics} from "./core/diagnostics-client.js";
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
initializeItemRecognition();
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
let routeController = null;
const viewCache = new ViewCache();
window.addEventListener("game-info-updated",()=>{
 refreshGameNews();
 const homeNews=app.querySelector(".home-news .news-grid");if(homeNews)homeNews.innerHTML=newsCards(newsEntries.slice(0,3));
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
 const link=([k,v])=>'<a href="#/'+k+'/'+(["map","boss","trader","item","quest","hideout","items-tracker"].includes(k)?db.mode:"")+'" data-section="'+k+'">'+v+'</a>';
 navigation.innerHTML='<a href="#/" data-section="">'+textPair("Главная","Home")+'</a>'+sections.slice(0,4).map(link).join("")+'<details class="more-navigation"><summary>'+textPair("Ещё","More")+'</summary><div class="more-panel">'+sections.slice(4).map(link).join("")+'<hr><button data-community="help">'+textPair("Помощь","Help")+'</button><a href="'+(communityUrl||'#/settings')+'" target="_blank" rel="noopener noreferrer">Discord ↗</a><button data-community="support">'+textPair("Поддержать проект","Support the project")+'</button></div></details>';
 installShell(navigation,{help:openHelp,support:openSupport});
}
function home() {
 renderRaidHome(app,{db,completed:Object.values(current().quests).filter(Boolean).length,news:newsCards(newsEntries.slice(0,3)),information:renderHomeInformation});
}
async function route() {
  routeController?.abort();
  routeController = new AbortController();
  const signal = routeController.signal;
  if (activeView) viewCache.save(activeView.key, app, {cache: activeView.catalog});
  activeView = null;
  window.dispatchEvent(new Event("view-changing"));
  const version = ++routeVersion;
  let path;
  try { path = decodeURIComponent(location.hash.slice(2).split("?")[0]).replace(
    /\/$/,
    "",
  ); } catch {
    app.innerHTML = errorView(new Error(textPair("Некорректная ссылка. Откройте нужный раздел через меню.", "Invalid link. Open the section using the menu.")));
    return;
  }
  const [section, modeOrSlug, slug] = path.split("/");
  document.querySelector("#modal").close();
  navigation.classList.remove("expanded");
 navigation.querySelectorAll("details").forEach(e=>e.open=false);
  navigation
    .querySelectorAll("a")
    .forEach((e) =>
      e.classList.toggle("active", e.dataset.section === section),
    );
  app.classList.toggle("wide", section === "map" && !!slug);
  app.innerHTML = '<div class="empty">Загрузка…</div>';
  try {
    if (["regular", "pve"].includes(modeOrSlug) && modeOrSlug !== db.mode) {
      const loaded = await loadMode(modeOrSlug);
      if (!loaded || signal.aborted) return;
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
        slug ? await renderItem(app, slug, {signal}) : renderCatalog(app);
        break;
      case "quest":
        slug ? await renderQuest(app, slug, {signal}) : await renderQuests(app, {signal});
        break;
      case "map":
        slug ? await renderMap(app, slug, {signal}) : renderMaps(app);
        break;
      case "hideout":
        slug ? await renderArticle(app, path, {signal}) : renderHideout(app);
        break;
      case "items-tracker":
        renderTracker(app);
        break;
      case "modifiers":
        renderModifiers(app);
        break;
      case "settings":
        await renderSettings(app, {signal});
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
        await renderGps(app, {signal});
        break;
      case "news":
        renderNews(app, slug || modeOrSlug);
        break;
      case "event-archive":
        renderArticleList(app,"event");
        break;
      case "event":
        if(modeOrSlug)await renderArticle(app,path,{signal});else renderInformation(app);
        break;
      case "boss":
      case "trader":
      case "season":
        slug || (modeOrSlug && !["regular", "pve"].includes(modeOrSlug))
          ? await renderArticle(app, path, {signal})
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
window.addEventListener("settings-save-failed", () => toast(textPair(
  "Не удалось записать настройки на диск. Они действуют в этом окне; проверьте доступ к папке приложения.",
  "Could not save settings to disk. They still apply in this window; check access to the application folder.",
)));
try {
  const startupResult = await prepareStartup();
  document.querySelector("#boot-stage").textContent =
    "Открываем интерфейс и личный профиль…";
  await loadState();
  await refreshEventContent();
  await init(profile().mode);
  if(!overlayMode) {void installDiagnostics();await initializeGameInfo();const seasonStatus=document.createElement("a");seasonStatus.id="season-status";seasonStatus.className="season-header-status";seasonStatus.hidden=true;document.querySelector(".statusline").insertBefore(seasonStatus,document.querySelector(".statusline").lastElementChild);const eventStatus=document.createElement("a");eventStatus.id="event-status";eventStatus.className="season-header-status event-header-status";eventStatus.hidden=true;seasonStatus.after(eventStatus);bindSeasonStatus(seasonStatus,eventStatus);}
  refreshGameNews();
  document.querySelector("#mode").value = db.mode;
      drawModeEmblem();
  document.querySelector("#logo").src = "/icons/app-192.png";
  renderSnapshotDate();
  nav();
  document.querySelector("#mode").onchange = async (e) => {
    const requested = e.target.value;
    try {
    if (!await loadMode(requested)) return;
    setMode(requested, {persist: !overlayMode});
    nav();
    const hash = location.hash.replace(
      /\/(regular|pve)(\/|$)/,
      "/" + db.mode + "$2",
    );
    if (hash !== location.hash) location.hash = hash;
    else route();
    } catch {
      e.target.value = db.mode;
      drawModeEmblem();
      toast(textPair("Не удалось переключить режим. Текущие данные сохранены.", "Could not switch mode. Your current data is preserved."));
    }
  };
  window.addEventListener("hashchange", route);
  await route();
  await finishStartup(startupResult);
  if (loadState.recovered) toast(textPair("Прогресс восстановлен из резервной копии. Сохраните отдельный экспорт в разделе «Данные».", "Progress was recovered from backup. Export a separate copy from Data and backups."));
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
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.repeat && (e.code === "KeyK" || e.key.toLowerCase() === "k")) {
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
