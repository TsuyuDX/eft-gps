import { language } from "./localization.js";
let started = false;
export function startAppUpdates() {
  if (started) return;
  started = true;
  const L = (ru, en) => (language() === "en" ? en : ru);
  const panel = document.createElement("aside");
  panel.className = "app-update";
  panel.hidden = true;
  panel.dataset.noTranslate = "";
  panel.innerHTML =
    '<div class="app-update-copy" role="status" aria-live="polite"></div><div class="row wrap"><button data-update-install></button><button class="app-update-dismiss"></button></div><details data-update-notes><summary></summary><pre style="white-space:pre-wrap;max-height:200px;overflow:auto"></pre></details><progress max="100" value="0"></progress>';
  document.body.append(panel);
  const install = panel.querySelector("[data-update-install]"),
    later = panel.querySelector(".app-update-dismiss"),
    notes = panel.querySelector("details");
  let dismissed = false,
    offered = "";
  later.textContent = L("Позже", "Later");
  later.onclick = () => {
    dismissed = true;
    panel.hidden = true;
  };
  install.textContent = L("Обновить", "Update");
  install.onclick = async () => {
    install.disabled = true;
    try {
      const response = await fetch("/api/app-update/install", {
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
    try {
      const response = await fetch("/api/app-update/state", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const state = await response.json();
      if (state.phase === "current") return;
      if (!["idle", "checking"].includes(state.phase)) {
        panel.hidden = dismissed;
        offered = state.version;
        install.hidden = state.phase !== "available";
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
          ["available", "error", "cancelled", "installer"].includes(state.phase)
        )
          return;
      }
      setTimeout(poll, 750);
    } catch {
      /* Offline mode must not interrupt the app. */
    }
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
