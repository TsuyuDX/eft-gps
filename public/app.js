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
const app = document.querySelector("#app"),
  navigation = document.querySelector("#navigation");
let routeVersion = 0;
const sections = [
  ["season", "Сезоны"],
  ["event", "Ивенты"],
  ["map", "Карты"],
  ["boss", "Боссы"],
  ["trader", "Торговцы"],
  ["item", "Предметы"],
  ["quest", "Квесты"],
  ["hideout", "Убежище"],
  ["items-tracker", "Трекер предметов"],
  ["gps", "GPS"],
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
  app.innerHTML = `<section class="home-hero"><h1>TarkovHead</h1><p>Всё, что нужно, чтобы выжить и преуспеть в Таркове — карты, квесты, предметы и многое другое.</p><div class="home-search"><span>⌕</span><input type="search" id="global-search" placeholder="Найти предметы, задания, модули убежища" autocomplete="off"><kbd>Ctrl K</kbd></div><div id="global-results" class="global-results" hidden></div></section><div class="dashboard-strip"><a href="#/map/${db.mode}"><b>${db.maps.length}</b> карт</a><a href="#/item/${db.mode}"><b>${db.items.length.toLocaleString("ru-RU")}</b> предметов</a><a href="#/quest/${db.mode}"><b>${completed} / ${db.quests.length}</b> заданий</a><a href="#/items-tracker/${db.mode}"><b>Мой прогресс</b> →</a></div><h2 class="center">Последние новости</h2><div class="card-grid news-grid">${db.articles
    .filter((x) => x.type === "news")
    .slice(0, 8)
    .map(
      (x) =>
        `<a class="card news-card" href="#/${x.path}">${img(x.image, x.title)}<div class="card-body"><h3>${esc(x.title)}</h3><p class="muted small">${esc(x.excerpt || "Обновления, события и руководства Escape from Tarkov.")}</p><span class="muted small">${esc(x.date || "Сохранено в офлайн-базе")}</span></div></a>`,
    )
    .join(
      "",
    )}</div><p class="center" style="margin-top:24px"><a class="button" href="#/news">Ко всем новостям →</a></p>`;
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
          type: "Квест",
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
        slug ? await renderQuest(app, slug) : renderQuests(app);
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
        renderSettings(app);
        break;
      case "gps":
        await renderGps(app);
        break;
      case "boss":
      case "trader":
      case "event":
      case "season":
      case "news":
        slug || (modeOrSlug && !["regular", "pve"].includes(modeOrSlug))
          ? await renderArticle(app, path)
          : renderArticleList(app, section);
        break;
      default:
        home();
    }
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
document.querySelector("#settings-link").onclick = () =>
  (location.hash = "/settings");
window.addEventListener("save-failed", () =>
  toast(
    "Не удалось записать файл. Прогресс остаётся в окне; сохраните резервную копию.",
  ),
);
try {
  await loadState();
  await init(profile().mode);
  document.querySelector("#mode").value = db.mode;
  document.querySelector("#logo").src = asset("/logo.png");
  document.querySelector("#snapshot-date").textContent =
    "Снимок " + new Date(db.manifest.savedAt).toLocaleDateString("ru-RU");
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
  startGpsClient(() => db.mode);
} catch (e) {
  app.innerHTML = errorView(e);
}
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
