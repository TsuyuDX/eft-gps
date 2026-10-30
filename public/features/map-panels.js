import { uiIcon } from "../core/icons.js";
import { getPreferences, setPreference } from "../core/preferences.js";
export function bindMapPanels(root) {
  const layout = root.querySelector(".map-layout");
  root.querySelectorAll("[data-toggle-panel]").forEach((button) => {
    const filters = button.dataset.togglePanel === "sidebar";
    button.innerHTML = button.closest(".map-panel-heading")
      ? uiIcon(filters ? "left" : "right")
      : uiIcon(filters ? "filters" : "list") +
        "<span>" +
        (filters ? "Фильтры" : "Задания") +
        "</span>";
  });
  function sync() {
    const prefs = getPreferences();
    for (const key of ["sidebar", "questBrowser"]) {
      const visible = prefs[key];
      layout.classList.toggle(
        key === "sidebar" ? "filters-collapsed" : "quests-collapsed",
        !visible,
      );
      root
        .querySelectorAll('[data-toggle-panel="' + key + '"]')
        .forEach((button) => {
          button.setAttribute("aria-pressed", String(visible));
          button.setAttribute("aria-expanded", String(visible));
        });
    }
  }
  root.querySelectorAll("[data-toggle-panel]").forEach(
    (button) =>
      (button.onclick = () => {
        const key = button.dataset.togglePanel;
        setPreference(key, !getPreferences()[key]);
        sync();
      }),
  );
  window.addEventListener("preferences-changed", sync);
  window.addEventListener(
    "view-changing",
    () => window.removeEventListener("preferences-changed", sync),
    { once: true },
  );
  sync();
}
