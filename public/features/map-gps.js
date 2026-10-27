import { gpsState } from "../core/gps-client.js";
import { floorFor } from "../core/gps-format.js";
import { projectPoint } from "../core/domain.js";
export function bindMapGps(root, map, { setFloor, center }) {
  const canvas = root.querySelector("#map-canvas"),
    dot = document.createElement("div"),
    label = document.createElement("div");
  dot.className = "gps-player";
  dot.hidden = true;
  dot.innerHTML =
    '<span class="gps-arrow">▲</span><span class="gps-player-label">Я</span>';
  dot.setAttribute("aria-label", "Моя позиция");
  canvas.append(dot);
  label.className = "gps-map-status";
  label.textContent = "GPS: подключить →";
  label.onclick = () => (location.hash = "/gps");
  label.tabIndex = 0;
  label.setAttribute("role", "button");
  label.onkeydown = (e) => {
    if (e.key === "Enter") location.hash = "/gps";
  };
  root.querySelector("#map-viewport").append(label);
  const controller = new AbortController();
  window.addEventListener(
    "view-changing",
    () => {
      controller.abort();
      clearInterval(timer);
    },
    { once: true },
  );
  let lastFix = 0;
  function update(s) {
    if (!s?.config.enabled) {
      dot.hidden = true;
      label.textContent = "⌖ Настроить GPS →";
      return;
    }
    const fix = s.fix;
    if (!fix || fix.map !== map.normalizedName) {
      dot.hidden = true;
      label.textContent = "⌖ GPS: ожидание позиции";
      return;
    }
    const age = Math.max(0, Math.floor((Date.now() - fix.updatedAt) / 1000)),
      p = projectPoint(fix.position, map),
      stale = age > Math.max(5, s.config.interval * 3);
    dot.hidden = p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100;
    dot.style.left = p.x + "%";
    dot.style.top = p.y + "%";
    dot.classList.toggle("stale", stale);
    const yaw = (fix.rotation * Math.PI) / 180,
      next = projectPoint(
        {
          x: fix.position.x + Math.sin(yaw),
          z: fix.position.z + Math.cos(yaw),
        },
        map,
      ),
      angle =
        (Math.atan2(
          (next.x - p.x) * canvas.offsetWidth,
          -(next.y - p.y) * canvas.offsetHeight,
        ) *
          180) /
        Math.PI;
    dot.querySelector(".gps-arrow").style.transform = `rotate(${angle}deg)`;
    dot.title = `Моя позиция · ${age} сек. назад · высота ${fix.position.y.toFixed(1)}`;
    label.textContent = `⌖ Я · ${age} сек. назад · Y ${fix.position.y.toFixed(1)}${stale ? " · устарела" : ""}`;
    if (fix.updatedAt !== lastFix) {
      if (s.config.autoFloor) setFloor(floorFor(fix.position, map));
      if (s.config.follow) center(p);
      lastFix = fix.updatedAt;
    }
  }
  window.addEventListener("gps-update", (e) => update(e.detail), {
    signal: controller.signal,
  });
  const timer = setInterval(() => update(gpsState), 1000);
  update(gpsState);
}
