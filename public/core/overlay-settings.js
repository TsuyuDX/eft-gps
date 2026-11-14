// Shared validation: the renderer and local service accept settings, never executable paths.
export const overlayDefaults = Object.freeze({
  hotkey: "Alt+M", opacity: 78, size: 78, position: "center",
  map: "factory", mode: "regular", autoMap: true, follow: false,
  labels: true, refreshMs: 1000,
});
export const overlayPositions = ["center", "top-left", "top-right", "bottom-left", "bottom-right"];
export const overlayHotkeys = ["Alt+M", "Ctrl+Shift+M", "F8"];
export function validOverlaySettings(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every(key => Object.hasOwn(overlayDefaults, key)) &&
    Object.entries(value).every(([key, item]) => {
      if (["autoMap", "follow", "labels"].includes(key)) return typeof item === "boolean";
      if (key === "hotkey") return overlayHotkeys.includes(item);
      if (key === "position") return overlayPositions.includes(item);
      if (key === "mode") return ["regular", "pve"].includes(item);
      if (key === "map") return typeof item === "string" && /^[a-z0-9-]{1,80}$/.test(item);
      return Number.isInteger(item) && (key === "opacity" ? item >= 35 && item <= 95 : key === "size" ? item >= 25 && item <= 95 : item >= 500 && item <= 2000);
    });
}
export function normalizeOverlaySettings(value) {
  const result = {...overlayDefaults};
  if (value && typeof value === "object")
    for (const key of Object.keys(result))
      if (Object.hasOwn(value,key) && validOverlaySettings({[key]:value[key]})) result[key] = value[key];
  return result;
}
export function validOverlayPreference(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    typeof value.enabled === "boolean" && Object.keys(value).every(key => ["enabled", "settings"].includes(key)) &&
    (value.settings === undefined || validOverlaySettings(value.settings));
}
