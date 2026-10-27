// Keep text editing and copying in content areas; app controls behave as controls.
export const selectableContent =
  "[data-selectable],.guide,.quest-guide,.description,.properties,.stats,.quest-context,.quest-columns,.gps-readout dd,.page-title h1,.quest-card-header h1,.quest-card-header h2,td,pre,code";
const installed = new WeakSet();
const editable =
  'textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]):not([type="file"]):not([type="color"]),[contenteditable]:not([contenteditable="false"])';
export function isBrowserShortcut(event) {
  const key = event.key.toLowerCase();
  if (key === "f4" && !event.altKey) return true;
  if (
    [
      "f1",
      "f3",
      "f5",
      "f6",
      "f7",
      "f9",
      "f10",
      "f11",
      "f12",
      "browserback",
      "browserforward",
      "browserhome",
      "browserrefresh",
      "browsersearch",
      "browserfavorites",
    ].includes(key)
  )
    return true;
  if (
    event.altKey &&
    ["arrowleft", "arrowright", "home", "d", "f", "e"].includes(key)
  )
    return true;
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  // Ctrl+K belongs to the app's search; normal text editing remains available.
  if (
    [
      "l",
      "o",
      "p",
      "s",
      "u",
      "n",
      "t",
      "w",
      "f",
      "h",
      "i",
      "j",
      "d",
      "e",
      "r",
      "+",
      "=",
      "-",
      "_",
      "0",
      "tab",
      "pageup",
      "pagedown",
    ].includes(key)
  )
    return true;
  return !!event.shiftKey && ["a", "b", "c", "k", "m", "y", "delete"].includes(key);
}
export function installDesktopUi(doc = document) {
  if (installed.has(doc)) return;
  installed.add(doc);
  doc.addEventListener(
    "keydown",
    (event) => {
      if (!isBrowserShortcut(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true },
  );
  doc.addEventListener(
    "wheel",
    (event) => {
      // Browser page zoom must not alter map controls or application layout.
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    },
    { capture: true, passive: false },
  );
  doc.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === "a" &&
      !event.target.closest?.(editable)
    )
      event.preventDefault();
  });
  doc.addEventListener("dragstart", (event) => {
    if (!event.target.closest?.(editable) && event.target.closest?.("img,a"))
      event.preventDefault();
  });
  doc.addEventListener("contextmenu", (event) => {
    const target = event.target;
    if (target.closest?.(editable)) return;
    if (
      target.closest?.(
        'button,.button,select,summary,.layer,.check,[role="tab"],.card,.map-viewport',
      ) ||
      !target.closest?.(selectableContent)
    )
      event.preventDefault();
  });
}
