import { textPair as L } from "./localization.js";
import { uiIcon } from "./icons.js";
import { locationPreview } from "./location-images.js";
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
    if (e) {
      tools.append(e);
      if (id !== "mode") {
        const label =
          id === "settings-link"
            ? L("Настройки", "Settings")
            : L("Поиск", "Search");
        e.setAttribute("aria-label", label);
        e.title = label + (id === "app-search-open" ? " · Ctrl+K" : "");
        e.innerHTML =
          uiIcon(id === "settings-link" ? "settings" : "search", 18) +
          (id === "app-search-open"
            ? '<span class="shell-search-label">' +
              label +
              "</span><kbd>Ctrl K</kbd>"
            : "");
      }
    }
  }
  const notifications = document.createElement("button");
  notifications.id = "notifications-open";
  notifications.title = L("Уведомления", "Notifications");
  notifications.setAttribute("aria-label", notifications.title);
  notifications.innerHTML = uiIcon("bell", 18);
  tools.querySelector("#settings-link")?.before(notifications);
  notifications.onclick = async () => {
    modal(
      "<h2>" +
        L("Уведомления", "Notifications") +
        '</h2><p role="status">' +
        L("Проверяем состояние…", "Checking status…") +
        "</p>",
    );
    const status = document.querySelector("#modal-content [role=status]");
    try {
      const r = await fetch("/api/app-update/state");
      if (!r.ok) throw Error("HTTP " + r.status);
      const state = await r.json();
      if (!status?.isConnected || !document.querySelector("#modal").open)
        return;
      status.textContent =
        state.phase === "available"
          ? L(
              "Доступно обновление. Подробности и установка — в панели обновления.",
              "An update is available. Use the update panel for details and installation.",
            )
          : L("Новых уведомлений нет.", "No new notifications.");
    } catch {
      if (status?.isConnected)
        status.replaceChildren(
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
  root.innerHTML = `<section class="raid-dashboard" aria-label="${L("Подготовка к рейду", "Raid preparation")}">
    <div class="raid-primary">
      <p class="eyebrow">${L("ПОДГОТОВКА К РЕЙДУ", "RAID PREPARATION")} <span class="raid-mode">${db.mode === "pve" ? "PvE" : "PvP"}</span></p>
      <h1>${L("Готов к рейду?", "Ready for a raid?")}</h1>
      <p class="muted" data-raid-readiness></p>
      <div class="row wrap raid-actions"><a id="home-open-map" class="button primary">${uiIcon("map", 18)}${L("Открыть карту", "Open map")}${uiIcon("right", 16)}</a><button id="home-gps">${L("Настроить GPS", "Configure GPS")}</button></div>
      <span data-home-gps-status class="raid-gps-state" role="status"></span>
    </div>
    <div class="raid-location">
      <figure class="raid-location-image"><img data-home-location-image alt="" width="480" height="270"><figcaption>${L("Выбранная локация", "Selected location")}</figcaption></figure>
      <label for="home-location">${uiIcon("locate", 16)}<span>${L("Локация", "Location")}</span></label>
      <select id="home-location">${db.maps.map((m) => `<option value="${esc(m.routeSlug || m.normalizedName)}" ${m === selected ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
    </div>
  </section>
  <div class="dashboard-strip">
    <a href="#/map/${db.mode}"><span class="dashboard-icon">${uiIcon("map", 20)}</span><span><b>${db.maps.length}</b><small>${L("Доступных карт", "Available maps")}</small></span>${uiIcon("right", 16)}</a>
    <a href="#/quest/${db.mode}"><span class="dashboard-icon">${uiIcon("check", 20)}</span><span><b>${completed} <em>/ ${db.quests.length}</em></b><small>${L("Заданий выполнено", "Quests completed")}</small></span>${uiIcon("right", 16)}</a>
    <a href="#/item/${db.mode}"><span class="dashboard-icon">${uiIcon("box", 20)}</span><span><b>${db.items.length.toLocaleString()}</b><small>${L("Предметов в базе", "Items in database")}</small></span>${uiIcon("right", 16)}</a>
    <a href="#/items-tracker/${db.mode}"><span class="dashboard-icon">${uiIcon("list", 20)}</span><span><b class="dashboard-label">${L("Мой прогресс", "My progress")}</b><small>${L("Предметы и задания", "Items and quests")}</small></span>${uiIcon("right", 16)}</a>
  </div>
  <div id="home-information"></div>
  <section class="home-news"><div class="section-heading"><h2>${L("Новости приложения и игры", "Application and game news")}</h2><a href="#/news">${L("Все новости", "All news")} ${uiIcon("right", 16)}</a></div><div class="card-grid news-grid">${news}</div></section>`;
  const location = root.querySelector("#home-location"),
    button = root.querySelector("#home-gps");
  const updateLink = () => {
    root.querySelector("#home-open-map").href =
      `#/map/${db.mode}/${location.value}`;
    const image = root.querySelector("[data-home-location-image]");
    const preview = locationPreview(location.value);
    image.parentElement.hidden = !preview;
    if (preview) image.src = preview;
    image.alt = location.selectedOptions[0]?.textContent || "";
  };
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
      : s?.config?.enabled
        ? L("Отключить GPS", "Disable GPS")
        : L("Включить GPS", "Enable GPS");
    const status = root.querySelector("[data-home-gps-status]");
    status.dataset.enabled = String(!!s?.config?.enabled);
    status.textContent = s?.config?.enabled
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
