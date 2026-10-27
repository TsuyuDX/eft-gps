import {
  savedLanguage,
  setLanguage,
  installLocalization,
  t,
} from "./localization.js";
import { gpsRequest } from "./gps-client.js";
const overlay = () => document.querySelector("#boot-screen");
function paintSteps(steps) {
  const list = document.querySelector("#boot-checks");
  list.innerHTML = steps
    .map(
      (s, i) =>
        `<li class="boot-check" data-state="${s.state}"><span class="boot-step-icon">${s.state === "ok" ? "✓" : s.state === "warning" ? "!" : s.state === "error" ? "×" : String(i + 1).padStart(2, "0")}</span><span>${t(s.label)}</span><small>${t({ pending: "Проверяем…", ok: "Готово", warning: "Требует внимания", error: "Ошибка" }[s.state])}</small></li>`,
    )
    .join("");
  document.querySelector("#boot-progress").toggleAttribute(
    "data-pending",
    steps.some((s) => s.state === "pending"),
  );
  const completed = steps.filter((s) => s.state !== "pending").length;
  document
    .querySelector("#boot-progress")
    .style.setProperty(
      "--progress",
      `${Math.round((completed / Math.max(1, steps.length)) * 100)}%`,
    );
  document
    .querySelector("#boot-progress")
    .setAttribute(
      "aria-valuenow",
      Math.round((completed / Math.max(1, steps.length)) * 100),
    );
}
export async function prepareStartup() {
  const language = savedLanguage();
  const choice = document.querySelector("#boot-language");
  if (!language) {
    choice.hidden = false;
    document.querySelector("#boot-stage").textContent =
      "Выберите язык интерфейса / Choose interface language";
    await new Promise((resolve) =>
      choice.querySelectorAll("[data-language]").forEach(
        (button) =>
          (button.onclick = () => {
            setLanguage(button.dataset.language);
            choice.hidden = true;
            resolve();
          }),
      ),
    );
  } else setLanguage(language, { persist: false });
  installLocalization();
  document.querySelector("#boot-stage").textContent = t(
    "Проверяем компоненты и локальные данные",
  );
  const steps = [
    { id: "connection", label: "Подключение к приложению", state: "pending" },
    { id: "data", label: "Локальная база", state: "pending" },
    { id: "paths", label: "Папка скриншотов", state: "pending" },
    { id: "gps", label: "Модуль GPS", state: "pending" },
    { id: "saves", label: "Сохранение прогресса", state: "pending" },
  ];
  paintSteps(steps);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/startup", { signal: controller.signal });
    if (!response.ok)
      throw Error(
        t("Перезапустите приложение, чтобы выполнить проверку запуска."),
      );
    const result = await response.json();
    const real = [
      { id: "connection", label: "Подключение к приложению", state: "ok" },
      ...result.checks,
    ];
    paintSteps(real);
    if (!result.ready)
      throw Error(
        t(
          "Не удалось проверить базу или записать сохранения. Проверьте папку приложения и повторите запуск.",
        ),
      );
    const state = await gpsRequest("state");
    const patch = {};
    if (!state.folderExists && result.discovered.screenshotsPath)
      patch.screenshotsPath = result.discovered.screenshotsPath;
    if (!state.logsExist && result.discovered.logsPath)
      patch.logsPath = result.discovered.logsPath;
    if (Object.keys(patch).length) await gpsRequest("settings", patch);
    return {
      warnings: real.filter((x) => x.state === "warning"),
      paths: result.discovered,
    };
  } finally {
    clearTimeout(timeout);
  }
}
export async function finishStartup(result) {
  const warnings = (result?.warnings || []).filter((x) =>
    ["gps", "screenshots"].includes(x.id),
  );
  if (warnings.length) {
    document.querySelector("#boot-stage").textContent = t("Проверка завершена");
    document.querySelector("#boot-warning").hidden = false;
    const detail = document.querySelector("#boot-warning-detail");
    detail.textContent = t(
      warnings.some((x) => x.id === "gps")
        ? "Модуль GPS не найден. Переустановите приложение для автосъёмки. Карты и справочник доступны."
        : "Путь можно выбрать в настройках GPS. Карты и справочник доступны без него.",
    );
    await new Promise((resolve) => {
      document.querySelector("#boot-continue").onclick = () => resolve();
      document.querySelector("#boot-configure").onclick = () => {
        location.hash = "/gps";
        resolve();
      };
    });
  }
  overlay().remove();
  document.body.classList.remove("booting");
  document.querySelector("main").removeAttribute("aria-hidden");
}
export function startupError(error) {
  const screen = overlay();
  if (!screen) return;
  screen.querySelector("#boot-language").hidden = true;
  screen.querySelector("#boot-warning").hidden = true;
  screen.querySelector("#boot-stage").textContent = t(
    "Не удалось подготовить приложение",
  );
  screen.querySelector("#boot-error").hidden = false;
  screen.querySelector("#boot-error-text").textContent =
    error?.name === "AbortError"
      ? t("Проверка заняла слишком много времени. Повторите попытку.")
      : error.message;
  screen.querySelector("#boot-retry").onclick = () => location.reload();
}
