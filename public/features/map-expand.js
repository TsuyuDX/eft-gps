import { openPreferences } from "../core/preferences.js";
import { toast } from "../core/ui.js";

// Expand inside the application window without entering browser fullscreen.
export function bindMapExpansion(root) {
  const layout = root.querySelector(".map-layout");
  const trigger = root.querySelector("#map-full");
  const actions = document.createElement("div");
  actions.className = "map-expanded-actions";
  actions.hidden = true;
  actions.innerHTML =
    '<button type="button" data-collapse-map>↙ Свернуть карту <kbd>Esc</kbd></button><button type="button" data-expanded-settings aria-label="Настройки развёрнутой карты">⚙</button>';
  layout.append(actions);
  function setExpanded(expanded) {
    layout.classList.toggle("map-expanded", expanded);
    document.body.classList.toggle("map-is-expanded", expanded);
    actions.hidden = !expanded;
    trigger.setAttribute("aria-expanded", String(expanded));
    if (expanded)
      actions.querySelector("button").focus({ preventScroll: true });
    else trigger.focus({ preventScroll: true });
  }
  trigger.setAttribute("aria-expanded", "false");
  trigger.onclick = () => {
    setExpanded(true);
    toast("Карта развёрнута · Esc — вернуться");
  };
  actions.querySelector("[data-collapse-map]").onclick = () =>
    setExpanded(false);
  actions.querySelector("[data-expanded-settings]").onclick = () =>
    openPreferences("Карта");
  function onEscape(event) {
    if (
      event.key !== "Escape" ||
      !layout.classList.contains("map-expanded") ||
      document.querySelector("dialog[open]")
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    setExpanded(false);
  }
  document.addEventListener("keydown", onEscape, true);
  window.addEventListener(
    "view-changing",
    () => {
      document.body.classList.remove("map-is-expanded");
      document.removeEventListener("keydown", onEscape, true);
    },
    { once: true },
  );
}
