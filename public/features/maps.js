import { db, json, asset } from "../core/data.js";
import { current, save } from "../core/state.js";
import { projectPoint } from "../core/domain.js";
import { heading, esc, img, modal, rich } from "../core/ui.js";
import { bindMapGps } from "./map-gps.js";
const groups = {
  lootLoose: ["Лут на карте", "#fde047", "◇"],
  btr: ["БТР и остановки", "#38bdf8", "▰"],
  extracts: ["Выходы", "#4ade80", "↗"],
  spawns: ["Спавны", "#60a5fa", "●"],
  lootContainers: ["Контейнеры", "#facc15", "▣"],
  locks: ["Ключи и двери", "#c084fc", "⚿"],
  hazards: ["Опасности", "#f87171", "!"],
  switches: ["Рычаги", "#fbbf24", "ϟ"],
  stationaryWeapons: ["Стационарное оружие", "#fb923c", "⌖"],
  transits: ["Переходы", "#2dd4bf", "⇄"],
  quests: ["Квесты", "#e879f9", "◆"],
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
function mapMarkers(m) {
  const a = [];
  for (const [group, [label, color, symbol]] of Object.entries(groups)) {
    if (group === "lootLoose") {
      for (const [category, g] of Object.entries(m.lootLoose || {}))
        for (const v of g.markers || [])
          a.push({
            ...v,
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
          ...(q.itemMarkers || []),
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
      for (const v of m[group] || []) {
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
    adding = false;
  const active = new Set(["extracts"]),
    markers = mapMarkers(m);
  const pins = () => current().pins[slug] || [];
  root.innerHTML = `<div class="map-top"><div class="row"><a href="#/map/${db.mode}">← Карты</a><h1>${esc(m.name)}</h1><span class="badge">${esc(String(m.duration).replace("min", "мин"))}</span></div><div class="row"><select id="floor" aria-label="Этаж карты"><option value="">Основной слой</option>${(m.layers || []).map((x, i) => `<option value="${i}">${esc(x.name)}</option>`).join("")}</select><button id="map-full">⛶ Во весь экран</button></div></div><div class="map-layout"><aside class="map-controls"><input type="search" id="marker-search" placeholder="Найти выход, квест, ключ…"><h3>Слои карты</h3>${Object.entries(
    groups,
  )
    .map(
      ([k, [name, color]]) =>
        `<label class="layer"><input type="checkbox" value="${k}" ${active.has(k) ? "checked" : ""}><span style="color:${color}">●</span> ${name}<small class="muted">${markers.filter((x) => x.group === k).length}</small></label>`,
    )
    .join(
      "",
    )}<hr><details><summary>Боссы и шанс появления</summary>${(m.bosses || []).map((b) => '<p class="small"><a href="#/boss/' + db.mode + "/" + b.normalizedName + '">' + esc(b.name) + "</a> · " + Math.round(b.spawnChance * 100) + "%<br>" + b.spawnLocations.map((l) => esc(l.name)).join(", ") + "</p>").join("")}</details><hr><button id="add-pin">＋ Своя метка</button><p class="small muted">Колесо — масштаб · перетаскивание — перемещение. Свои метки сохраняются в профиле.</p><h3>Метки</h3><div id="marker-list"></div><p class="small muted">${esc(m.author || "Tarkov.dev")}<br>${esc(m.description)}</p></aside><div class="map-viewport" id="map-viewport"><div class="map-canvas" id="map-canvas"><img class="map-image" id="map-image" alt="${esc(m.name)}" draggable="false"><div id="markers"></div></div><div class="zoom-controls"><button id="zoom-in" aria-label="Приблизить">＋</button><button id="zoom-out" aria-label="Отдалить">−</button><button id="zoom-reset" aria-label="Сбросить масштаб">⌂</button></div><div class="map-caption">${esc(m.name)} · <span id="map-scale">100%</span> · ОФЛАЙН</div></div></div>`;
  const viewport = root.querySelector("#map-viewport"),
    canvas = root.querySelector("#map-canvas"),
    image = root.querySelector("#map-image");
  image.src = m.renderedPath || asset(m.svgPath || m.image);
  const fit = () => {
    const ratio = (image.naturalWidth || 1) / (image.naturalHeight || 1),
      w = viewport.clientWidth,
      h = viewport.clientHeight,
      cw = Math.min(w, h * ratio),
      ch = cw / ratio;
    canvas.style.inset = "auto";
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    canvas.style.left = (w - cw) / 2 + "px";
    canvas.style.top = (h - ch) / 2 + "px";
  };
  image.onload = fit;
  new ResizeObserver(fit).observe(viewport);
  const transform = () => {
    canvas.style.transform = `translate(${tx}px,${ty}px) scale(${zoom})`;
    root.querySelector("#map-scale").textContent = Math.round(zoom * 100) + "%";
  };
  function showMarker(x, index, pin = false) {
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
    image.src =
      floor?.renderedPath ||
      m.renderedPath ||
      asset(floor?.svgPath || m.svgPath || m.image);
    const filtered = markers.filter(
      (x) =>
        (active.has(x.group) || search) &&
        (!search ||
          (x.title + " " + (x.quest?.name || ""))
            .toLowerCase()
            .includes(search)) &&
        (!floor?.extents?.length ||
          floor.extents.some(
            (e) => x.position.y >= e.height[0] && x.position.y <= e.height[1],
          )),
    );
    const visible = filtered
      .map((x, i) => {
        const p = projectPoint(x.position, m);
        return { x, i, p };
      })
      .filter(({ p }) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);
    root.querySelector("#markers").innerHTML =
      visible
        .map(
          ({ x, i, p }) =>
            `<button class="map-marker" data-marker="${i}" style="left:${p.x}%;top:${p.y}%;--marker:${x.color}" title="${esc(x.title)}">${x.symbol}</button>`,
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
            `<button class="marker-row" data-marker="${i}"><span style="color:${x.color}">${x.symbol}</span> ${esc(x.title)}</button>`,
        )
        .join("");
    root
      .querySelectorAll("[data-marker]")
      .forEach(
        (b) =>
          (b.onclick = () => showMarker(filtered[Number(b.dataset.marker)])),
      );
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
  root.querySelectorAll(".layer input").forEach(
    (e) =>
      (e.onchange = () => {
        e.checked ? active.add(e.value) : active.delete(e.value);
        draw();
      }),
  );
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
  const changeZoom = (delta) => {
    zoom = Math.max(0.5, Math.min(12, zoom * delta));
    transform();
  };
  viewport.onwheel = (e) => {
    e.preventDefault();
    changeZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };
  root.querySelector("#zoom-in").onclick = () => changeZoom(1.3);
  root.querySelector("#zoom-out").onclick = () => changeZoom(1 / 1.3);
  root.querySelector("#zoom-reset").onclick = () => {
    zoom = 1;
    tx = ty = 0;
    transform();
  };
  root.querySelector("#map-full").onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.querySelector(".map-layout").requestFullscreen();
  };
  draw();
  bindMapGps(root, m, {
    setFloor(value) {
      if (layer === String(value)) return;
      layer = String(value);
      root.querySelector("#floor").value = layer;
      draw();
    },
    center(p) {
      const width = canvas.offsetWidth,
        height = canvas.offsetHeight;
      tx = -(p.x / 100 - 0.5) * width * zoom;
      ty = -(p.y / 100 - 0.5) * height * zoom;
      transform();
    },
  });
}
