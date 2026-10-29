import { readWindowSetting, writeWindowSetting } from "./window-settings.js";
export const markerStyleKey = "tarkov-map-markers-v1";
export function getMarkerStyle() {
  try {
    return JSON.parse(readWindowSetting(markerStyleKey))?.style === "classic"
      ? "classic"
      : "new";
  } catch {
    return "new";
  }
}
export function setMarkerStyle(value) {
  if (!["new", "classic"].includes(value)) return;
  writeWindowSetting(markerStyleKey, JSON.stringify({ style: value }));
  window.dispatchEvent(new Event("map-marker-style-changed"));
}
export function bindMarkerStyleControls(root) {
  const sync = () =>
    root.querySelectorAll("[data-marker-style]").forEach((select) => {
      select.value = getMarkerStyle();
    });
  root.querySelectorAll("[data-marker-style]").forEach((select) => {
    select.onchange = () => setMarkerStyle(select.value);
  });
  const controller = new AbortController();
  window.addEventListener("map-marker-style-changed", sync, {
    signal: controller.signal,
  });
  window.addEventListener("view-changing", () => controller.abort(), {
    once: true,
  });
  const dialog = root.closest?.("dialog");
  if (dialog)
    dialog.addEventListener("close", () => controller.abort(), { once: true });
  sync();
}
export const markerStyleOptions =
  '<option value="new">Новые метки</option><option value="classic">Классические метки</option>';
