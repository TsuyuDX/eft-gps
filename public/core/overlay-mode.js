// This presentation mode changes no saved map filters or user progress.
export const overlayMode = new URLSearchParams(globalThis.location?.search || "").get("overlay") === "1";
const overlayQuery = new URLSearchParams(globalThis.location?.search || "");
export const overlayFollow = overlayQuery.get("follow") === "1";
export const overlayAutoMap = overlayQuery.get("autoMap") !== "0";
if (overlayMode && typeof document !== "undefined") {
  document.documentElement.classList.add("raid-overlay");
  document.documentElement.classList.toggle("overlay-hide-labels",overlayQuery.get("labels")==="0");
  const style = document.createElement("link");
  style.rel = "stylesheet"; style.href = "/overlay.css"; document.head.append(style);
  // The overlay is a read-only display. Help and guide dialogs stay in the main app.
  const closeDialogs = () => document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
  new MutationObserver(closeDialogs).observe(document.documentElement, {subtree:true, attributes:true, attributeFilter:["open"]});
}
