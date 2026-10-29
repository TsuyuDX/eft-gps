// A session-only Easter egg. Never stored in the user profile or window settings.
let presses = 0;
let active = false;
export const isSecretThemeActive = () => active;
export function resetSecretTheme() {
  presses = 0;
  active = false;
  document.documentElement.classList.remove("secret-maps-theme");
  window.dispatchEvent(new Event("map-marker-style-changed"));
}
export function pressSecretTheme() {
  if (active) return false;
  presses++;
  if (presses !== 16) return false;
  active = true;
  document.documentElement.classList.add("secret-maps-theme");
  window.dispatchEvent(new Event("map-marker-style-changed"));
  return true;
}
export function secretMarkerIcon(path) {
  return active
    ? path.replace("/eft-gps-markers/", "/secret-maps-markers/")
    : path;
}
