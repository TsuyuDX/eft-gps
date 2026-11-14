import {uiIcon} from "./icons.js";
import {t} from "./localization.js";
import {overlayMode,overlayAutoMap} from "./overlay-mode.js";
export let gpsState = null;
let timer = null,
  pending = null,
  previousMap = null,
  previousFix = null;
export async function gpsRequest(url, value) {
  const response = await fetch(
    "/api/gps/" + url,
    value === undefined
      ? { signal: AbortSignal.timeout(10000) }
      : {
          signal: AbortSignal.timeout(10000),
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "GPS недоступен. Перезапустите приложение.");
  return data;
}
export async function pollGps() {
  if (pending) return pending;
  pending = (async () => { try {
    gpsState = await gpsRequest("state");
    window.dispatchEvent(new CustomEvent("gps-update", { detail: gpsState }));
    return gpsState;
  } catch {
    return null;
  } })().finally(() => { pending = null; });
  return pending;
}
export function startGpsClient(getMode) {
  if (timer) return;
  const badge = document.createElement("a");
  badge.id = "gps-pill";
  badge.className = "pill";
  badge.href = "#/gps";
  badge.textContent = "⌖ GPS";
  document.querySelector(".statusline .row")?.append(badge);
  window.addEventListener("gps-update", ({ detail: s }) => {
    const label=t(s.auto ? "Авто" : s.config.enabled ? "Включён" : "Выключен");
    const key=String(s.config.enabled)+"/"+label;
    if(badge.dataset.stateKey!==key){
      badge.dataset.stateKey=key;
      badge.classList.toggle("gps-on",s.config.enabled);badge.classList.toggle("gps-auto",s.auto);
      badge.innerHTML=uiIcon("locate",16)+'<span>GPS</span><span class="gps-pill-state">'+label+'</span>';
      badge.title=t("Настроить GPS");
    }
    if (
      s.config.enabled &&
      (overlayMode ? overlayAutoMap : s.config.autoMap) &&
      s.fix &&
      Date.now() - s.fix.updatedAt < 60000 &&
      s.fix.updatedAt !== previousFix
    ) {
      if (previousMap !== s.fix.map)
        location.hash = "/map/" + (s.fix.mode || getMode()) + "/" + s.fix.map;
      previousMap = s.fix.map;
    }
    if (!s.config.enabled) previousMap = null;
    previousFix = s.fix?.updatedAt;
  });
  pollGps();
  timer = setInterval(pollGps, 1000);
}
