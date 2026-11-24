import { textPair as L } from "./localization.js";
import { uiIcon } from "./icons.js";
import { gpsState, gpsRequest, pollGps } from "./gps-client.js";
import { esc, modal, toast } from "./ui.js";
let installed = false;
export function installShell(nav, actions) {
  for (const b of nav.querySelectorAll("[data-community]"))
    b.onclick = () => {
      b.closest("details").open = false;
      actions[b.dataset.community]();
    };
  if (installed) return;
  installed = true;
  const tools = document.createElement("div");
  tools.className = "shell-tools";
  document.querySelector(".topline").append(tools);
  // Keep existing handlers and IDs when moving controls.
  for (const id of ["app-search-open", "settings-link", "mode"]) {
    const e = document.getElementById(id);
    if (e) tools.append(e);
  }
  const notifications = document.createElement("button");
  notifications.id = "notifications-open";
  notifications.title = L("Уведомления", "Notifications");
  notifications.setAttribute("aria-label", notifications.title);
  notifications.innerHTML = uiIcon("news", 18);
  tools.querySelector("#settings-link")?.before(notifications);
  notifications.onclick = async () => {
    modal(
      "<h2>" +
        L("Уведомления", "Notifications") +
        '</h2><p role="status">' +
        L("Проверяем состояние…", "Checking status…") +
        "</p>",
    );
    const root = document.querySelector("#modal-content");
    try {
      const r = await fetch("/api/app-update/state");
      if (!r.ok) throw Error("HTTP " + r.status);
      const state = await r.json();
      if (!root.isConnected || !root.querySelector("[role=status]")) return;
      root.querySelector("[role=status]").textContent =
        state.phase === "available"
          ? L(
              "Доступно обновление. Подробности и установка — в панели обновления.",
              "An update is available. Use the update panel for details and installation.",
            )
          : L("Новых уведомлений нет.", "No new notifications.");
    } catch {
      root
        .querySelector("[role=status]")
        ?.replaceChildren(
          document.createTextNode(
            L(
              "Не удалось проверить обновления. Текущая версия продолжает работать.",
              "Could not check updates. Your current version remains available.",
            ),
          ),
        );
    }
  };
  document.addEventListener("click", (e) => {
    for (const d of nav.querySelectorAll("details[open]"))
      if (!d.contains(e.target)) d.open = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      for (const d of nav.querySelectorAll("details")) d.open = false;
  });
}
export function renderRaidHome(root, { db, completed, news, information }) {
  const s = gpsState,
    slug = s?.map || s?.config?.map;
  const selected =
    db.maps.find((m) => (m.routeSlug || m.normalizedName) === slug) ||
    db.maps[0];
  root.innerHTML = `<section class="raid-dashboard"><div class="raid-intro"><div><p class="eyebrow">EFT GPS · ${db.mode === "pve" ? "PvE" : "PvP"}</p><h1>${L("Готов к рейду?", "Ready for a raid?")}</h1><p class="muted" data-raid-readiness></p></div><label>${L("Локация", "Location")}<select id="home-location">${db.maps.map((m) => `<option value="${esc(m.routeSlug || m.normalizedName)}" ${m === selected ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label></div><div class="row wrap raid-actions"><a id="home-open-map" class="button primary">${uiIcon("map", 18)}${L("Открыть карту", "Open map")}</a><button id="home-gps">${L("Настроить GPS", "Configure GPS")}</button><span data-home-gps-status class="muted" role="status"></span></div></section><div class="dashboard-strip"><a href="#/map/${db.mode}"><b>${db.maps.length}</b> ${L("карт", "maps")}</a><a href="#/quest/${db.mode}"><b>${completed} / ${db.quests.length}</b> ${L("заданий", "quests")}</a><a href="#/item/${db.mode}"><b>${db.items.length.toLocaleString()}</b> ${L("предметов", "items")}</a><a href="#/items-tracker/${db.mode}">${L("Мой прогресс →", "My progress →")}</a></div><div id="home-information"></div><section class="home-news"><h2>${L("Новости приложения и игры", "Application and game news")}</h2><div class="card-grid news-grid">${news}</div><a class="button" href="#/news">${L("Все новости →", "All news →")}</a></section>`;
  const location = root.querySelector("#home-location"),
    button = root.querySelector("#home-gps");
  const updateLink = () =>
    (root.querySelector("#home-open-map").href =
      `#/map/${db.mode}/${location.value}`);
  updateLink();
  location.onchange = updateLink;
  const draw = (s) => {
    if (!root.querySelector("#home-gps")) return;
    const ready = !!s?.folderExists;
    root.querySelector("[data-raid-readiness]").textContent = ready
      ? L("Карты и GPS готовы к работе", "Maps and GPS are ready")
      : L(
          "Карты доступны. Для GPS выберите папку скриншотов.",
          "Maps are ready. Select a screenshots folder to use GPS.",
        );
    button.textContent = !ready
      ? L("Настроить GPS", "Configure GPS")
      : s.config.enabled
        ? L("Отключить GPS", "Disable GPS")
        : L("Включить GPS", "Enable GPS");
    root.querySelector("[data-home-gps-status]").textContent = s?.config.enabled
      ? L("GPS включён", "GPS enabled")
      : L("GPS выключен", "GPS disabled");
  };
  draw(s);
  button.onclick = async () => {
    if (!gpsState?.folderExists) {
      window.location.hash = "/gps";
      return;
    }
    button.disabled = true;
    try {
      await gpsRequest("settings", { enabled: !gpsState.config.enabled });
      await pollGps();
    } catch (e) {
      toast(e.message);
    } finally {
      button.disabled = false;
    }
  };
  const controller = new AbortController();
  window.addEventListener("gps-update", (e) => draw(e.detail), {
    signal: controller.signal,
  });
  window.addEventListener("view-changing", () => controller.abort(), {
    once: true,
  });
  information(root.querySelector("#home-information"));
}
