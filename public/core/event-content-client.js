import {
  acceptEventContent,
  eventContentState,
  eventRevision,
} from "./event-content.js";
import { language } from "./localization.js";
let active = false,
  timer = null,
  updating = null;
export async function refreshEventContent() {
  if (updating) return updating;
  updating = (async () => {
    try {
      const response = await fetch(
        "/api/event-content?revision=" + eventRevision(),
        { signal: AbortSignal.timeout(2500), cache: "no-store" },
      );
      if (!response.ok) return false;
      const changed = acceptEventContent(await response.json());
      window.dispatchEvent(new Event("event-content-status"));
      if (changed) window.dispatchEvent(new Event("event-content-updated"));
      return changed;
    } catch {
      return false;
    } finally {
      updating = null;
    }
  })();
  return updating;
}
export function startEventContent(onUpdate) {
  if (active) return;
  active = true;
  window.addEventListener("event-content-updated", () => {
    Promise.resolve()
      .then(() => onUpdate?.())
      .catch(() => {});
  });
  async function poll() {
    try {
      await refreshEventContent();
    } catch {
      /* Keep the current view if a local reload is interrupted. */
    } finally {
      timer = setTimeout(
        poll,
        eventContentState.phase === "checking" ? 1500 : 30000,
      );
    }
  }
  void poll();
}
export function eventSyncMarkup() {
  return '<section class="event-sync panel"><div><strong data-event-sync-title></strong><small class="muted block" data-event-sync-status></small></div><button type="button" data-event-sync-check></button></section>';
}
export function bindEventSync(root) {
  const title = root.querySelector("[data-event-sync-title]"),
    status = root.querySelector("[data-event-sync-status]"),
    button = root.querySelector("[data-event-sync-check]");
  if (!button) return;
  function draw() {
    const en = language() === "en",
      state = eventContentState;
    title.textContent = en
      ? "Event walkthrough updates"
      : "Обновление прохождений события";
    const checked = state.lastSuccess
      ? new Date(state.lastSuccess).toLocaleString(en ? "en-US" : "ru-RU")
      : "";
    status.textContent =
      state.phase === "checking"
        ? en
          ? "Checking for new guides…"
          : "Проверяем новые материалы…"
        : state.phase === "offline"
          ? en
            ? "Source unavailable. Saved guides remain available offline."
            : "Источник недоступен. Сохранённые прохождения работают офлайн."
          : checked
            ? (en
                ? "Last successful check: "
                : "Последняя успешная проверка: ") + checked
            : en
              ? "Checks at startup and every 15 minutes. Offline guides are included."
              : "Проверка при запуске и раз в 15 минут. Офлайн-прохождения уже в комплекте.";
    button.textContent = en ? "Check now" : "Проверить сейчас";
    button.disabled = state.phase === "checking";
  }
  button.onclick = async () => {
    button.disabled = true;
    try {
      await fetch("/api/event-content/check", { method: "POST" });
      await refreshEventContent();
    } catch {
      /* The bundled guide remains available. */
    } finally {
      draw();
    }
  };
  draw();
  window.addEventListener("event-content-status", draw);
  window.addEventListener(
    "view-changing",
    () => window.removeEventListener("event-content-status", draw),
    { once: true },
  );
}
