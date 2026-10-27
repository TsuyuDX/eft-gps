import { localeCode } from "./core/localization.js";
import { APP_TITLE } from "./core/brand.js";
import { openHelp, maybeShowTour } from "./features/help.js";
import { openSupport } from "./features/support.js";
import { language, t } from "./core/localization.js";
import { prepareStartup, finishStartup, startupError } from "./core/startup.js";
import { newsCards, newsEntries, renderNews } from "./features/news.js";
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
installAppNavigation();
installDesktopUi();
installBackNavigation();
await loadWindowSettings();
applyPreferences();
const app = document.querySelector("#app"),
  navigation = document.querySelector("#navigation");
let routeVersion = 0;
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
  ["season", "Сезоны"],
  ["news", "Новости"],
];

function nav() {
  navigation.innerHTML = sections
    .map(
      ([k, v]) =>
        `<a href="#/${k}/${["map", "boss", "trader", "item", "quest", "hideout", "items-tracker"].includes(k) ? db.mode : ""}" data-section="${k}">${v}</a>`,
    )
    .join("");
}
function home() {
  const completed = Object.values(current().quests).filter(Boolean).length;
  app.innerHTML = `<section class="home-hero"><div class="eyebrow">НАВИГАЦИЯ / ПОДГОТОВКА / РЕЙД</div><h1>EFT <span>GPS</span></h1><p>Всё для следующего рейда. Карты, GPS, задания и личный прогресс.</p><div class="row wrap home-actions"><a class="button primary" href="#/map/${db.mode}">Открыть карты ↗</a><a class="button" href="#/gps">Настроить GPS</a></div><div class="home-search"><span>⌕</span><input type="search" id="global-search" placeholder="Найти предметы, задания, модули убежища" autocomplete="off"><kbd>Ctrl K</kbd></div><div id="global-results" class="global-results" hidden></div></section><div class="dashboard-strip"><a href="#/map/${db.mode}"><b>${db.maps.length}</b> карт</a><a href="#/item/${db.mode}"><b>${db.items.length.toLocaleString(localeCode())}</b> предметов</a><a href="#/quest/${db.mode}"><b>${completed} / ${db.quests.length}</b> заданий</a><a href="#/items-tracker/${db.mode}"><b>Мой прогресс</b> →</a></div><section class="home-news"><h2 class="center">На связи с Тарковом</h2><div class="card-grid news-grid">${newsCards(newsEntries.slice(0, 4))}</div><p class="center" style="margin-top:24px"><a class="button" href="#/news">Все новости →</a></p></section>`;
  const field = app.querySelector("#global-search"),
    box = app.querySelector("#global-results");
  field.oninput = () => {
    const q = field.value.toLowerCase().trim();
    box.hidden = !q;
    if (!q) return;
    const results = [
      ...db.items
        .filter((x) => x.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map((x) => ({
          name: x.name,
          icon: x.iconLink,
          href: `item/${db.mode}/${x.normalizedName}`,
          type: "Предмет",
        })),
      ...db.quests
        .filter((x) => x.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map((x) => ({
          name: x.name,
          icon: x.iconLink || db.lookup.traders?.[x.trader]?.imageLink,
          href: `quest/${db.mode}/${x.normalizedName}`,
          type: "Задание",
        })),
      ...Object.values(db.lookup.hideout || {})
        .filter((x) => x.name.toLowerCase().includes(q))
        .map((x) => ({
          name: x.name,
          icon: x.imageLink,
          href: `hideout/${db.mode}/${x.normalizedName}`,
          type: "Убежище",
        })),
      ...db.maps
        .filter((x) => x.name.toLowerCase().includes(q))
        .map((x) => ({
          name: x.name,
          icon: x.imageThumb,
          href: `map/${db.mode}/${x.normalizedName}`,
          type: "Карта",
        })),
    ];
    box.innerHTML =
      results
        .map(
          (x) =>
            `<a href="#/${x.href}">${img(x.icon, x.name)}<span>${esc(x.name)}</span><small class="muted">${x.type}</small></a>`,
        )
        .join("") || "<p>Ничего не найдено</p>";
  };
  field.onkeydown = (e) => {
    if (e.key === "Enter") box.querySelector("a")?.click();
    if (e.key === "Escape") box.hidden = true;
  };
}
async function route() {
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
      setMode(modeOrSlug);
      document.querySelector("#mode").value = db.mode;
      nav();
    }
    if (version !== routeVersion) return;
    switch (section) {
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
      case "gps":
        await renderGps(app);
        break;
      case "news":
        renderNews(app, slug || modeOrSlug);
        break;
      case "boss":
      case "trader":
      case "event":
      case "season":
        slug || (modeOrSlug && !["regular", "pve"].includes(modeOrSlug))
          ? await renderArticle(app, path)
          : renderArticleList(app, section);
        break;
      default:
        home();
    }
    if (version !== routeVersion) return;
    addBackButton(app);
    window.scrollTo(0, 0);
  } catch (e) {
    if (version === routeVersion) app.innerHTML = errorView(e);
  }
}
document.querySelector("#modal .close").onclick = () =>
  document.querySelector("#modal").close();
document.querySelector("#modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
document.querySelector("#menu").onclick = () =>
  navigation.classList.toggle("expanded");
document.querySelector("#settings-link").onclick = openPreferences;
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
  await init(profile().mode);
  document.querySelector("#mode").value = db.mode;
  document.querySelector("#logo").src = "/icons/app-192.png";
  document.querySelector("#snapshot-date").textContent =
    "Снимок " + new Date(db.manifest.savedAt).toLocaleDateString(localeCode());
  nav();
  document.querySelector("#mode").onchange = async (e) => {
    await loadMode(e.target.value);
    setMode(e.target.value);
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
  maybeShowTour();
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
    document.querySelector("#snapshot-date").textContent = "Снимок " + new Date(db.manifest.savedAt).toLocaleDateString(localeCode());
    nav();
    await route();
    if (preferencesOpen) openPreferences(selectedTab);
  } catch (error) {
    app.innerHTML = errorView(error);
  }
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!document.querySelector("#global-search")) {
      location.hash = "/";
      setTimeout(() => document.querySelector("#global-search")?.focus(), 100);
    } else document.querySelector("#global-search").focus();
  }
});
function clock() {
  const elapsed = Date.now() / 1000,
    seconds = Math.floor((elapsed * 7 + 10800) % 86400),
    hours = Math.floor(seconds / 3600),
    mins = Math.floor((seconds % 3600) / 60);
  document.querySelector("#raid-time").textContent =
    `☀ ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}  ☾ ${String((hours + 12) % 24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
clock();
setInterval(clock, 10000);
setInterval(() => fetch("/api/health").catch(() => {}), 20000);
