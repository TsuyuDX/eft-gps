import { uiIcon } from "../core/icons.js";
import { toast } from "../core/ui.js";
export function bindMapExpansion(root) {
  const workspace =
      root.querySelector(".map-workspace") || root.querySelector(".map-layout"),
    trigger = root.querySelector("#map-full");
  function setExpanded(value) {
    workspace.classList.toggle("map-expanded", value);
    document.body.classList.toggle("map-is-expanded", value);
    trigger.setAttribute("aria-expanded", String(value));
    trigger.innerHTML =
      uiIcon(value ? "collapse" : "expand") +
      "<span>" +
      (value ? "Свернуть карту · Esc" : "Развернуть карту") +
      "</span>";
  }
  setExpanded(false);
  trigger.onclick = () =>
    setExpanded(!workspace.classList.contains("map-expanded"));
  function onEscape(event) {
    if (
      event.key === "Escape" &&
      workspace.classList.contains("map-expanded") &&
      !document.querySelector("dialog[open]")
    ) {
      event.preventDefault();
      event.stopPropagation();
      setExpanded(false);
      trigger.focus({ preventScroll: true });
    }
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
