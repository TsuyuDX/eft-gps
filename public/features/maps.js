import {
  readWindowSetting,
  writeWindowSetting,
} from "../core/window-settings.js";
import { bindMapExpansion } from "./map-expand.js";
import { floorLabel } from "../core/map-labels.js";
import { openPreferences } from "../core/preferences.js";
import { db, json, asset } from "../core/data.js";
import { current, save } from "../core/state.js";
import { projectPoint } from "../core/domain.js";
import { heading, esc, img, modal, rich, toast } from "../core/ui.js";
import { mapIcon, markerIcon } from "../core/map-icons.js";
import { floorFor } from "../core/gps-format.js";
import { markerSubtype, markerGroups } from "../core/map-options.js";
import { createMapDetail } from "./map-detail.js";
import { createHazardOverlay } from "./map-hazards.js";
import { createMapQuestPanel } from "./map-quests.js";
import { openQuestPreview } from "./quest-detail.js";
import { bindMapGps } from "./map-gps.js";
const groups = {
  lootLoose: ["Предметы на карте", "#fde047", "◇"],
  btr: ["БТР и остановки", "#38bdf8", "▰"],
  extracts: ["Выходы", "#4ade80", "↗"],
  spawns: ["Точки появления", "#60a5fa", "●"],
  lootContainers: ["Контейнеры", "#facc15", "▣"],
  locks: ["Ключи и двери", "#c084fc", "⚿"],
  hazards: ["Опасности", "#f87171", "!"],
  artillery: ["Миномётные обстрелы", "#f87171", "!"],
  switches: ["Переключатели", "#fbbf24", "ϟ"],
  stationaryWeapons: ["Стационарное оружие", "#fb923c", "⌖"],
  transits: ["Переходы", "#2dd4bf", "⇄"],
  quests: ["Задания", "#e879f9", "◆"],
  seasonalDocuments: ["Сезонные документы", "#a3e635", "▤"],
};
export function renderMaps(root) {
  root.innerHTML =
    heading(
      "Карты",
      "Выходы, спавны, ключи, лут и задания · доступно без интернета",
    ) +
    `<div class="card-grid maps-grid">${db.maps.map((m) => `<a class="card map-card" href="#/map/${db.mode}/${m.normalizedName}">${img(m.preview || m.svgPath || m.imageThumb || m.image, m.name)}<div class="card-body"><h2>${esc(m.name)}</h2><p class="muted small">${esc(m.description || "")}</p><span class="badge">${esc(String(m.duration || "—").replace("min", "мин"))}</span> <span class="badge">${esc(m.players || "—")} игроков</span></div></a>`).join("")}</div>`;
}
export function mapMarkers(m) {
  const a = [];
  for (const [group, [label, color, symbol]] of Object.entries(groups)) {
    if (group === "lootLoose") {
      for (const [category, g] of Object.entries(m.lootLoose || {}))
        for (const v of g.markers || [])
          a.push({
            ...v,
            category,
            group,
            color,
            symbol,
            title:
              category + ": " + (v.items || []).map((x) => x.name).join(", "),
          });
    } else if (group === "btr") {
      for (const route of m.btrRoutes || [])
        for (const p of route.points || [])
          if (p.stopName)
            a.push({
              position: { x: p.y, z: p.x, y: p.z || 0 },
              group,
              color,
              symbol,
              title: p.stopName,
              description: route.name,
            });
    } else if (group === "quests") {
      for (const q of m.questLayers || [])
        for (const v of [
          ...(q.itemMarkers || []).map((v) => ({ ...v, questItem: true })),
          ...(q.objectiveMarkers || []),
        ])
          a.push({
            ...v,
            group,
            color,
            symbol,
            title: v.name || q.questData?.name,
            quest: q.questData,
            description: v.objDescription,
          });
    } else
      for (const v of (group === "artillery" ? m.artillery?.zones : m[group]) ||
        []) {
        const title =
          v.label ||
          v.name ||
          v.description ||
          v.lootContainer?.name ||
          v.stationaryWeapon?.name ||
          v.key?.name ||
          v.zoneName ||
          label;
        a.push({ ...v, group, color, symbol, title });
      }
  }
  return a.filter((x) => x.position);
}
export async function renderMap(root, slug) {
  const { map: m } = await json(
    (db.mode === "pve" ? "pve/" : "") + "maps/" + slug + ".json",
  );
  let zoom = 1,
    tx = 0,
    ty = 0,
    drag = null,
    layer = "",
    search = "",
    adding = false,
    showHazardZones = true,
    selectedQuest = "",
    pendingFocus = null;
  const active = new Set(["extracts"]),
    markers = mapMarkers(m);
  const disabledTypes = new Set();
  const subgroups = markerGroups(markers, m);
  const filtersKey = `map-filters-v2-${db.mode}-${slug}`;
  try {
    const saved = JSON.parse(readWindowSetting(filtersKey));
    if (saved && Array.isArray(saved.active) && Array.isArray(saved.disabled)) {
      showHazardZones = saved.showHazardZones !== false;
      active.clear();
      saved.active.forEach((g) => active.add(g));
      saved.disabled.forEach((k) => disabledTypes.add(k));
    }
  } catch {}
  const details = await json("map-detail.json").catch(() => ({}));
  const questMetadata = await json(db.mode + "/quest-search.json").catch(
    () => ({}),
  );
  for (const marker of markers)
    if (marker.quest)
      marker.quest = {
        ...marker.quest,
        icon:
          questMetadata[marker.quest.normalizedName]?.icon || marker.quest.icon,
      };
  const pins = () => current().pins[slug] || [];
  const layerIcons = {
    lootLoose: "loose_loot",
    btr: null,
    extracts: "extract_shared",
    spawns: "spawn_pmc",
    lootContainers: "container_weapon-box",
    locks: "lock",
    hazards: "hazard",
    artillery: "hazard_mortar",
    switches: "switch",
    stationaryWeapons: "stationarygun",
    transits: "extract_transit",
    quests: "quest_objective",
    seasonalDocuments: null,
  };
  root.innerHTML = `<div class="map-top"><div class="row"><a href="#/map/${db.mode}">← Карты</a><h1>${esc(m.name)}</h1><span class="badge">${esc(String(m.duration).replace("min", "мин"))}</span></div><div class="row"><select id="floor" aria-label="Этаж карты"><option value="">Основной слой</option>${(m.layers || []).map((x, i) => `<option value="${i}">${esc(floorLabel(x.name))}</option>`).join("")}</select><button id="map-preferences" aria-label="Настройки карты" title="Скрыть панели и лишние элементы">⚙ Настройки</button><button id="map-full">⛶ Развернуть карту</button></div></div><div class="map-layout"><aside class="map-controls"><input type="search" id="marker-search" placeholder="Найти выход, задание, ключ…"><div id="map-quests"></div><h3>Слои карты</h3><label class="check hazard-display"><input id="hazard-show-all" type="checkbox" ${showHazardZones ? "checked" : ""}> Показывать все зоны опасностей</label>${Object.entries(
    groups,
  )
    .map(([k, [name]]) => {
      const entries = [...(subgroups.get(k)?.values() || [])].sort((a, b) =>
        a.label.localeCompare(b.label, "ru"),
      );
      const icon =
        k === "btr"
          ? asset("/api/media/file/btr-icon.png")
          : k === "seasonalDocuments"
            ? asset("/api/media/file/season-1-doc-financial-documentation.webp")
            : mapIcon(layerIcons[k]);
      const master = `<label class="layer"><input type="checkbox" data-group="${k}" aria-label="${esc(name)}" ${active.has(k) ? "checked" : ""}><img class="map-layer-icon" src="${icon}" alt=""> ${name}<small class="muted">${markers.filter((x) => x.group === k).length}</small></label>`;
      return entries.length
        ? `<details class="map-layer-group" ${k === "lootContainers" ? "open" : ""}><summary>${master}</summary><div class="map-subtypes">${entries.map((e) => `<label class="layer subtype"><input type="checkbox" data-subtype="${esc(e.key)}" data-parent="${k}" aria-label="${esc(e.label)}" ${active.has(k) && !disabledTypes.has(e.key) ? "checked" : ""}><img class="map-layer-icon" src="${markerIcon(e.marker, m)}" alt=""><span>${esc(e.label)}</span><small class="muted">${e.count}</small></label>`).join("")}</div></details>`
        : master;
    })
    .join(
      "",
    )}<hr><details><summary>Боссы и шанс появления</summary>${(m.bosses || []).map((b) => '<p class="small"><a href="#/boss/' + db.mode + "/" + b.normalizedName + '">' + esc(b.name) + "</a> · " + Math.round(b.spawnChance * 100) + "%<br>" + b.spawnLocations.map((l) => esc(l.name)).join(", ") + "</p>").join("")}</details><hr><button id="add-pin">＋ Своя метка</button><p class="small muted">Колесо — масштаб · перетаскивание — перемещение. Свои метки сохраняются в профиле.</p><section class="map-marker-list"><h3>Видимые метки</h3><div id="marker-list"></div></section><p class="small muted">${esc(m.author || "Tarkov.dev")}<br>${esc(m.description)}</p></aside><div class="map-viewport" id="map-viewport"><div class="map-canvas" id="map-canvas"><img class="map-image" id="map-image" alt="${esc(m.name)}" draggable="false"><img class="map-floor-image" id="map-floor-image" alt="" draggable="false" hidden><div id="map-base-detail" class="map-detail"></div><div id="map-floor-detail" class="map-detail"></div><svg id="hazard-zones" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg><div id="markers"></div></div><div class="zoom-controls"><button id="zoom-in" aria-label="Приблизить">＋</button><button id="zoom-out" aria-label="Отдалить">−</button><button id="zoom-reset" aria-label="Сбросить масштаб">⌂</button></div><div class="map-caption">${esc(m.name)} · <span id="map-scale">100%</span> · Тарков GPS</div></div></div>`;
  const viewport = root.querySelector("#map-viewport"),
    canvas = root.querySelector("#map-canvas"),
    image = root.querySelector("#map-image");
  image.src =
    (m.svgPath && asset(m.svgPath) !== "/assets/fallback.svg"
      ? asset(m.svgPath)
      : m.renderedPath) || asset(m.image);
  let baseWidth = 1,
    baseHeight = 1;
  const baseDetail = createMapDetail(
    root.querySelector("#map-base-detail"),
    viewport,
    canvas,
    details,
  );
  const floorDetail = createMapDetail(
    root.querySelector("#map-floor-detail"),
    viewport,
    canvas,
    details,
  );
  const hazardOverlay = createHazardOverlay(
    root.querySelector("#hazard-zones"),
    m,
  );
  const viewController = new AbortController();
  window.addEventListener("view-changing", () => viewController.abort(), {
    once: true,
  });
  document
    .querySelector("#modal")
    .addEventListener("close", () => hazardOverlay.highlight(null), {
      signal: viewController.signal,
    });
  function focusQuestPoint(marker) {
    const p = projectPoint(marker.position, m);
    zoom = Math.max(zoom, 2.5);
    tx = -(p.x / 100 - 0.5) * baseWidth * zoom;
    ty = -(p.y / 100 - 0.5) * baseHeight * zoom;
    transform();
  }
  root.querySelector("#map-preferences").onclick = () =>
    openPreferences("Карта");
  const questPanel = createMapQuestPanel(root.querySelector("#map-quests"), {
    markers,
    metadata: questMetadata,
    onSelect(value) {
      selectedQuest = value;
      active.add("quests");
      disabledTypes.delete("quests|item");
      disabledTypes.delete("quests|objective");
      search = "";
      root.querySelector("#marker-search").value = "";
      syncFilters();
      draw();
      questPanel.setSelected(value);
      const marker = markers.find((x) => x.quest?.normalizedName === value);
      if (marker) focusQuestPoint(marker);
    },
    onOpen(value) {
      openQuestPreview(value, { mapName: m.name });
    },
  });
  const fit = () => {
    const ratio = (image.naturalWidth || 1) / (image.naturalHeight || 1),
      w = viewport.clientWidth,
      h = viewport.clientHeight,
      cw = Math.min(w, h * ratio),
      ch = cw / ratio;
    baseWidth = cw;
    baseHeight = ch;
    if (pendingFocus) {
      focusQuestPoint(pendingFocus);
      pendingFocus = null;
    }
    transform();
  };
  image.onload = fit;
  const resizeObserver = new ResizeObserver(fit);
  resizeObserver.observe(viewport);
  window.addEventListener("view-changing", () => resizeObserver.disconnect(), {
    once: true,
  });
  function transform() {
    const width = baseWidth * zoom,
      height = baseHeight * zoom;
    canvas.style.inset = "auto";
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.style.left = (viewport.clientWidth - width) / 2 + tx + "px";
    canvas.style.top = (viewport.clientHeight - height) / 2 + ty + "px";
    canvas.style.setProperty(
      "--map-icon-scale",
      Math.max(1, 1 / Math.pow(Math.max(1, zoom), 0.12)),
    );
    root.querySelector("#map-scale").textContent = Math.round(zoom * 100) + "%";
    baseDetail.update();
    floorDetail.update();
  }
  function showMarker(x, index, pin = false) {
    if (x.quest?.normalizedName) {
      openQuestPreview(x.quest.normalizedName, { marker: x, mapName: m.name });
      return;
    }
    if (!pin) hazardOverlay.highlight(index);
    modal(
      `<span class="eyebrow">${esc(pin ? "Своя метка" : groups[x.group]?.[0])}</span><h2>${esc(x.title || x.name)}</h2>${x.quest ? `<p><a href="#/quest/${db.mode}/${x.quest.normalizedName}">${esc(x.quest.name)} →</a></p>` : ""}${x.key ? `<a href="#/item/${db.mode}/${x.key.normalizedName}">${esc(x.key.name)}</a>` : ""}<div class="guide">${rich(x.description || x.objDescription || x.details)}</div>${x.image ? img(x.image, x.title, "guide-image") : ""}${x.items ? "<h3>Возможный лут</h3>" + x.items.map((i) => '<p><a href="#/item/' + db.mode + "/" + i.normalizedName + '">' + esc(i.name) + "</a></p>").join("") : ""}${x.faction ? `<p>Сторона: ${esc(x.faction)}</p>` : ""}${x.position ? `<p class="muted small">X: ${Number(x.position.x).toFixed(1)} · Y: ${Number(x.position.y).toFixed(1)} · Z: ${Number(x.position.z).toFixed(1)}</p>` : ""}${pin ? `<button id="delete-pin">Удалить свою метку</button>` : ""}`,
    );
    if (pin)
      document.querySelector("#delete-pin").onclick = () => {
        current().pins[slug].splice(index, 1);
        save();
        document.querySelector("#modal").close();
        draw();
      };
  }
  function draw() {
    const floor = layer === "" ? null : m.layers[Number(layer)];
    const floorImage = root.querySelector("#map-floor-image");
    const floorSource =
      floor?.renderedPath || (floor?.svgPath ? asset(floor.svgPath) : "");
    const highFloor = floorDetail.setSource(floor);
    baseDetail.setSource(m);
    const showFloor =
      highFloor || (!!floorSource && floorSource !== "/assets/fallback.svg");
    canvas.classList.toggle("has-floor", showFloor);
    floorImage.hidden = !showFloor || highFloor;
    if (showFloor && floorImage.getAttribute("src") !== floorSource)
      floorImage.src = floorSource;
    const filtered = markers.filter(
      (x) =>
        (active.has(x.group) || search) &&
        (x.group !== "quests" ||
          !selectedQuest ||
          x.quest?.normalizedName === selectedQuest) &&
        (!markerSubtype(x, m) ||
          !disabledTypes.has(x.group + "|" + markerSubtype(x, m).id)) &&
        (!search ||
          (x.title + " " + (x.quest?.name || ""))
            .toLowerCase()
            .includes(search)),
    );
    const visible = filtered
      .map((x, i) => {
        const p = projectPoint(x.position, m);
        return { x, i, p };
      })
      .filter(({ p }) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);
    hazardOverlay.render(filtered, {
      all: showHazardZones,
      muted: (x) => floor && floorFor(x.position, m) !== Number(layer),
    });
    root.querySelector("#markers").innerHTML =
      visible
        .map(
          ({ x, i, p }) =>
            `<button class="map-marker map-marker-icon${floor && floorFor(x.position, m) !== Number(layer) ? " other-floor" : ""}" data-marker="${i}" style="left:${p.x}%;top:${p.y}%;--marker:${x.color}" title="${esc(x.title)}" aria-label="${esc(x.title)}"><img src="${markerIcon(x, m)}" alt="" draggable="false" style="width:${x.iconSize?.[0] || 24}px;height:${x.iconSize?.[1] || 24}px">${x.quest?.icon ? `<img class="quest-marker-badge" src="${asset(x.quest.icon)}" alt="">` : ""}</button>`,
        )
        .join("") +
      pins()
        .filter((p) => p.layer === layer)
        .map(
          (p) =>
            `<button class="map-marker custom-pin" data-pin="${pins().indexOf(p)}" style="left:${p.x}%;top:${p.y}%;--marker:#fff" title="${esc(p.name)}">⚑</button>`,
        )
        .join("");
    root.querySelector("#marker-list").innerHTML =
      `<p class="muted small">Показано ${visible.length} меток</p>` +
      visible
        .slice(0, 120)
        .map(
          ({ x, i }) =>
            `<button class="marker-row" data-marker="${i}"><img class="map-layer-icon" src="${markerIcon(x, m)}" alt=""> ${esc(x.title)}</button>`,
        )
        .join("");
    root.querySelectorAll("[data-marker]").forEach((b) => {
      const index = Number(b.dataset.marker);
      b.onclick = () => showMarker(filtered[index], index);
      b.onpointerenter = b.onfocus = () => hazardOverlay.highlight(index);
      b.onpointerleave = b.onblur = () => {
        if (!document.querySelector("#modal").open)
          hazardOverlay.highlight(null);
      };
    });
    root
      .querySelectorAll("[data-pin]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            showMarker(
              pins()[Number(b.dataset.pin)],
              Number(b.dataset.pin),
              true,
            )),
      );
  }
  function syncFilters() {
    root.querySelectorAll("[data-group]").forEach((e) => {
      const entries = [...(subgroups.get(e.dataset.group)?.keys() || [])];
      const selected = active.has(e.dataset.group)
        ? entries.filter((k) => !disabledTypes.has(k)).length
        : 0;
      e.checked =
        active.has(e.dataset.group) &&
        (!entries.length || selected === entries.length);
      e.indeterminate = selected > 0 && selected < entries.length;
    });
    root.querySelectorAll("[data-subtype]").forEach((e) => {
      e.checked =
        active.has(e.dataset.parent) && !disabledTypes.has(e.dataset.subtype);
    });
    try {
      writeWindowSetting(
        filtersKey,
        JSON.stringify({
          active: [...active],
          disabled: [...disabledTypes],
          showHazardZones,
        }),
      );
    } catch {}
  }
  root.querySelectorAll("[data-group]").forEach((e) => {
    e.onclick = (event) => event.stopPropagation();
    e.onchange = () => {
      e.checked ? active.add(e.dataset.group) : active.delete(e.dataset.group);
      for (const key of subgroups.get(e.dataset.group)?.keys() || [])
        disabledTypes.delete(key);
      syncFilters();
      draw();
    };
  });
  root.querySelectorAll("[data-subtype]").forEach(
    (e) =>
      (e.onchange = () => {
        if (e.checked && !active.has(e.dataset.parent)) {
          for (const key of subgroups.get(e.dataset.parent)?.keys() || [])
            disabledTypes.add(key);
          active.add(e.dataset.parent);
        }
        e.checked
          ? disabledTypes.delete(e.dataset.subtype)
          : disabledTypes.add(e.dataset.subtype);
        if (
          [...(subgroups.get(e.dataset.parent)?.keys() || [])].every((k) =>
            disabledTypes.has(k),
          )
        )
          active.delete(e.dataset.parent);
        syncFilters();
        draw();
      }),
  );
  syncFilters();
  root.querySelector("#hazard-show-all").onchange = (e) => {
    showHazardZones = e.target.checked;
    syncFilters();
    draw();
  };
  root.querySelector("#marker-search").oninput = (e) => {
    search = e.target.value.toLowerCase();
    draw();
  };
  root.querySelector("#floor").onchange = (e) => {
    layer = e.target.value;
    draw();
  };
  root.querySelector("#add-pin").onclick = () => {
    adding = !adding;
    viewport.classList.toggle("pin-mode", adding);
    root.querySelector("#add-pin").textContent = adding
      ? "Нажмите на карте…"
      : "＋ Своя метка";
  };
  viewport.onpointerdown = (e) => {
    if (e.target.closest("button")) return;
    if (adding) {
      const rect = canvas.getBoundingClientRect(),
        x = (100 * (e.clientX - rect.left)) / rect.width,
        y = (100 * (e.clientY - rect.top)) / rect.height;
      modal(
        `<h2>Своя метка</h2><form id="pin-form"><input id="pin-name" required maxlength="100" placeholder="Название метки"><button class="primary">Сохранить</button></form>`,
      );
      document.querySelector("#pin-form").onsubmit = (e) => {
        e.preventDefault();
        const name = document.querySelector("#pin-name").value.trim();
        if (!name) return;
        current().pins[slug] ??= [];
        current().pins[slug].push({ x, y, name, layer });
        save();
        document.querySelector("#modal").close();
        adding = false;
        viewport.classList.remove("pin-mode");
        root.querySelector("#add-pin").textContent = "＋ Своя метка";
        draw();
      };
      return;
    }
    drag = { x: e.clientX, y: e.clientY, tx, ty };
    viewport.setPointerCapture(e.pointerId);
  };
  viewport.onpointermove = (e) => {
    if (drag) {
      tx = drag.tx + e.clientX - drag.x;
      ty = drag.ty + e.clientY - drag.y;
      transform();
    }
  };
  viewport.onpointerup = () => (drag = null);
  viewport.onpointercancel = () => (drag = null);
  const changeZoom = (delta, anchorX = 0, anchorY = 0) => {
    const next = Math.max(0.5, Math.min(12, zoom * delta)),
      ratio = next / zoom;
    tx = anchorX - (anchorX - tx) * ratio;
    ty = anchorY - (anchorY - ty) * ratio;
    zoom = next;
    transform();
  };
  viewport.onwheel = (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    changeZoom(
      e.deltaY < 0 ? 1.12 : 1 / 1.12,
      e.clientX - rect.left - rect.width / 2,
      e.clientY - rect.top - rect.height / 2,
    );
  };
  root.querySelector("#zoom-in").onclick = () => changeZoom(1.3);
  root.querySelector("#zoom-out").onclick = () => changeZoom(1 / 1.3);
  root.querySelector("#zoom-reset").onclick = () => {
    zoom = 1;
    tx = ty = 0;
    transform();
  };
  bindMapExpansion(root);
  const pointQuery = new URLSearchParams(location.hash.split("?")[1] || "");
  const pointId = pointQuery.get("q"),
    questSlug = pointQuery.get("quest");
  const linkedMarker = markers.find(
    (x) =>
      x.group === "quests" &&
      ((pointId &&
        (String(x.id) === pointId || String(x.quest?.id) === pointId)) ||
        (questSlug && x.quest?.normalizedName === questSlug)),
  );
  if (linkedMarker) {
    selectedQuest = linkedMarker.quest.normalizedName;
    active.add("quests");
    disabledTypes.delete("quests|item");
    disabledTypes.delete("quests|objective");
    pendingFocus = linkedMarker;
    questPanel.setSelected(selectedQuest);
    syncFilters();
  } else if (questSlug || pointId) {
    toast(
      "На этой карте для задания не сохранены отдельные точки. Доступен общий план локации.",
    );
  }
  draw();
  bindMapGps(root, m, {
    setFloor(value) {
      if (layer === String(value)) return;
      layer = String(value);
      root.querySelector("#floor").value = layer;
      draw();
    },
    center(p) {
      const width = baseWidth,
        height = baseHeight;
      tx = -(p.x / 100 - 0.5) * width * zoom;
      ty = -(p.y / 100 - 0.5) * height * zoom;
      transform();
    },
  });
}
