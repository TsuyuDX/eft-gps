import {textPair} from "./localization.js";
import { language } from "./localization.js";
let started = false;
export function startAppUpdates() {
  if (started) return;
  started = true;
  const L = textPair;
  const panel = document.createElement("aside");
  panel.className = "app-update";
  panel.hidden = true;
  panel.dataset.noTranslate = "";
  panel.innerHTML =
    '<div class="app-update-copy" role="status" aria-live="polite"></div><div class="row wrap"><button data-update-install></button><button data-update-cancel hidden></button><button class="app-update-dismiss"></button></div><details data-update-notes><summary></summary><pre style="white-space:pre-wrap;max-height:200px;overflow:auto"></pre></details><progress max="100" value="0"></progress>';
  document.body.append(panel);
  const install = panel.querySelector("[data-update-install]"),
    later = panel.querySelector(".app-update-dismiss"),
    notes = panel.querySelector("details");
  const cancel = panel.querySelector("[data-update-cancel]");
  let timer, polling = false, localFailures = 0;
  const schedule = (delay = 750) => { clearTimeout(timer); timer = setTimeout(poll, delay); };
  cancel.onclick = async () => {
    cancel.disabled = true;
    try {
      const response = await fetch("/api/app-update/cancel", {method:"POST", signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw Error();
      dismissed = false;
      schedule();
    } catch {
      cancel.disabled = false;
    }
  };
  let dismissed = false,
    offered = "";
  later.textContent = L("Позже", "Later");
  later.onclick = () => {
    dismissed = true;
    panel.hidden = true;
  };
  install.textContent = L("Обновить", "Update");
  install.onclick = async () => {
    dismissed = false;
    install.disabled = true;
    try {
      const response = await fetch("/api/app-update/install", {
        signal: AbortSignal.timeout(10000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: offered }),
      });
      if (!response.ok) throw Error();
      install.hidden = true;
      notes.hidden = true;
      void poll();
    } catch {
      panel.querySelector(".app-update-copy").textContent = L(
        "Не удалось начать обновление. Текущая версия продолжает работать.",
        "Could not start the update. Your current version remains available.",
      );
      install.disabled = false;
    }
  };
  async function poll() {
    if (polling) return;
    polling = true;
    try {
      const response = await fetch("/api/app-update/state", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw Error("local-updater-unavailable");
      const state = await response.json();
      localFailures = 0;
      cancel.hidden = !["downloading", "verifying"].includes(state.phase);
      cancel.disabled = false;
      cancel.textContent = L("Отменить загрузку", "Cancel download");
      later.textContent = ["downloading", "verifying"].includes(state.phase) ? L("Скрыть", "Hide") : L("Позже", "Later");
      panel.querySelector("progress").setAttribute("aria-label", L("Загрузка обновления", "Update download"));
      if (state.phase === "current") return;
      if (!["idle", "checking"].includes(state.phase)) {
        panel.hidden = dismissed;
        offered = state.version;
        install.hidden = state.phase !== "available" && !(["error","cancelled"].includes(state.phase) && state.version);
        install.disabled = false;install.textContent=["error","cancelled"].includes(state.phase)?L("Повторить", "Retry"):L("Обновить", "Update");
        notes.hidden = state.phase !== "available";
        notes.querySelector("summary").textContent = L(
          "Что нового",
          "What’s new",
        );
        notes.querySelector("pre").textContent =
          state.changelog ||
          L(
            "Описание изменений не опубликовано.",
            "Release notes have not been published.",
          );
        const progress = panel.querySelector("progress");
        progress.value = state.percent;
        progress.hidden = !["downloading", "verifying"].includes(state.phase);
        const mb = (value) => (value / 1024 ** 2).toFixed(1);
        panel.querySelector(".app-update-copy").textContent =
          state.phase === "available"
            ? L("Доступна версия ", "Version available: ") +
              state.version +
              L(
                ". Установите, когда будет удобно.",
                ". Install whenever you are ready.",
              )
            : state.phase === "downloading"
              ? L(
                  state.kind === "delta"
                    ? "Загрузка изменений"
                    : "Загрузка обновления",
                  state.kind === "delta"
                    ? "Downloading changes"
                    : "Downloading update",
                ) +
                ` ${state.version} · ${state.percent}% · ${state.file} · ${mb(state.downloaded)} / ${mb(state.total)} MB`
              : state.phase === "verifying"
                ? L("Проверка обновления…", "Verifying update…")
                : state.phase === "installer"
                  ? L(
                      "Обновление загружено · 100%. Подтвердите установку.",
                      "Update downloaded · 100%. Confirm installation.",
                    )
                  : state.phase === "cancelled"
                    ? L(
                        "Обновление отменено. Текущая версия продолжает работать.",
                        "Update cancelled. Your current version remains available.",
                      )
                    : [
                          "installer-missing",
                          "installer-access",
                          "installer-start",
                        ].includes(state.error)
                      ? L(
                          "Пакет проверен и сохранён. Не удалось запустить установщик. Проверьте журнал защиты Windows; не игнорируйте обнаружение угрозы.",
                          "The verified package is saved. Setup could not start. Check Windows protection history; do not ignore a threat detection.",
                        )
                      : state.error === "download-timeout"
                        ? L("Загрузка остановилась: сервер не передаёт данные. Проверьте соединение и нажмите «Повторить».", "The download stalled: the server stopped sending data. Check your connection and click Retry.")
                      : state.error === "disk-space"
                        ? L(
                            "Недостаточно места для обновления.",
                            "Not enough disk space to update.",
                          )
                        : state.error === "checksum"
                          ? L(
                              "Проверка пакета не пройдена. Файлы приложения не изменены.",
                              "Package verification failed. Application files were not changed.",
                            )
                          : L(
                              "Обновления сейчас недоступны. Проверим при следующем запуске.",
                              "Updates are unavailable. We will check on the next launch.",
                            );
        if (
          ["available", "error", "cancelled"].includes(state.phase)
        )
          return;
      }
      schedule();
    } catch {
      // Retry the local status request, never the GitHub release check or installation.
      // Keep retries bounded if an older local service does not support this endpoint.
      if (++localFailures <= 3) schedule(3000);
    } finally { polling = false; }
  }
  window.addEventListener("language-changed", () => {
    install.textContent = L("Обновить", "Update");
    later.textContent = L("Позже", "Later");
    void poll();
  });
  fetch("/api/app-update/start", { method: "POST" })
    .then((r) => {
      if (r.ok) void poll();
    })
    .catch(() => {});
}
