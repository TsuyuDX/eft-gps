import {textPair} from "./localization.js";
import { language } from "./localization.js";
export function startConnectivityStatus() {
  const element = document.querySelector("#connection-status");
  if (!element) return () => {};
  let online = null,
    timer,
    pending = false,
    disposed = false;
  const paint = () => {
    element.classList.toggle("is-online", online === true);
    element.classList.toggle("is-offline", online === false);
    element.querySelector("[data-connection-label]").textContent =
      online === null
        ? textPair("Проверка связи…","Checking connection…")
        : online
          ? textPair("Онлайн","Online")
          : textPair("Оффлайн","Offline");
    element.title =
      textPair("Доступ к интернету. Карты и сохранённый справочник доступны и без сети.","Internet connectivity. Maps and the saved reference remain available offline.");
  };
  const refresh = async () => {
    clearTimeout(timer);
    if (disposed || document.hidden) return;
    if (navigator.onLine === false) {
      online = false;
      paint();
      return;
    }
    if (pending) return;
    pending = true;
    try {
      const response = await fetch("/api/connectivity", { cache: "no-store" });
      online = response.ok && (await response.json()).online === true;
    } catch {
      online = false;
    } finally {
      pending = false;
      if (navigator.onLine === false) online = false;
      if (!disposed) {
        paint();
        timer = setTimeout(refresh, 60000);
      }
    }
  };
  const offline = () => {
    online = false;
    paint();
    clearTimeout(timer);
  };
  const visible = () => {
    if (!document.hidden) void refresh();
  };
  window.addEventListener("online", refresh);
  window.addEventListener("offline", offline);
  window.addEventListener("language-changed", paint);
  document.addEventListener("visibilitychange", visible);
  paint();
  void refresh();
  return () => {
    disposed = true;
    clearTimeout(timer);
    window.removeEventListener("online", refresh);
    window.removeEventListener("offline", offline);
    window.removeEventListener("language-changed", paint);
    document.removeEventListener("visibilitychange", visible);
  };
}
