import { readWindowSetting, writeWindowSetting } from "./window-settings.js";
import { language } from "./localization.js";
const key = "tarkov-overlay-v1";
const L = (ru, en) => (language() === "en" ? en : ru);
export function overlayEnabled() {
  try {
    return JSON.parse(readWindowSetting(key))?.enabled === true;
  } catch {
    return false;
  }
}
export async function setOverlayEnabled(enabled) {
  const response = await fetch("/api/overlay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const state = await response.json();
  if (!response.ok) throw Error(state.error || "overlay-start-failed");
  writeWindowSetting(key, JSON.stringify({ enabled }));
  return state;
}
export async function initializeOverlay() {
  if (overlayEnabled())
    try {
      await setOverlayEnabled(true);
    } catch {
      window.dispatchEvent(new Event("overlay-unavailable"));
    }
}
export function renderOverlayControl(root) {
  root.innerHTML =
    '<h3>Overlay · Beta</h3><label class="preference-row"><span><strong>' +
    L("Экспериментальный оверлей", "Experimental overlay") +
    '</strong><small class="muted">' +
    L(
      "Полупрозрачная карта поверх игры. Нужен оконный режим без рамки.",
      "A translucent map over the game. Requires borderless windowed mode.",
    ) +
    '</small></span><input type="checkbox" data-overlay-enabled></label><p class="muted small" data-overlay-status role="status"></p>';
  const input = root.querySelector("input"),
    status = root.querySelector("[data-overlay-status]");
  input.checked = overlayEnabled();
  const show = (state) => {
    status.textContent = !input.checked
      ? L(
          "Overlay выключен. Его фоновые процессы не запускаются.",
          "Overlay disabled. Its background processes are not started.",
        )
      : state?.running
        ? L(
            "Overlay включён. Карта открывается по выбранной горячей клавише.",
            "Overlay enabled. Use the selected hotkey to show the map.",
          )
        : L(
            "Окно Overlay не запущено. Выключите и включите функцию, чтобы повторить запуск.",
            "The Overlay window is not running. Toggle the feature off and on to start it again.",
          );
  };
  if (input.checked) {
    status.textContent = L(
      "Проверяем состояние Overlay…",
      "Checking Overlay status…",
    );
    fetch("/api/overlay")
      .then((r) => r.json())
      .then((state) => {
        if (!input.disabled) show(state);
      })
      .catch(() => show());
  } else show();
  input.onchange = async () => {
    const enabled = input.checked;
    input.disabled = true;
    status.textContent = L("Применяем настройку…", "Applying setting…");
    try {
      const state = await setOverlayEnabled(enabled);
      show(state);
    } catch {
      input.checked = !enabled;
      status.textContent = L(
        "Не удалось переключить Overlay. Проверьте наличие компонента и перезапустите приложение.",
        "Could not toggle Overlay. Check that its component is installed and restart the app.",
      );
    } finally {
      input.disabled = false;
    }
  };
}
