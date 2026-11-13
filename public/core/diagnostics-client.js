import { textPair as L } from "./localization.js";
import { esc, toast, modal } from "./ui.js";
let enabled = false;
async function request(path = "", body) {
  const r = await fetch(
    "/api/diagnostics" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (!r.ok) throw Error("diagnostics-unavailable");
  return r.json();
}
// Только код ошибки, без message/stack, адреса страницы или введённых данных.
export async function installDiagnostics() {
  try {
    enabled = (await request()).enabled;
  } catch {}
  window.addEventListener("error", () => {
    if (enabled)
      void request("/event", { category: "interface", code: "ui-error" }).catch(
        () => {},
      );
  });
  window.addEventListener("unhandledrejection", () => {
    if (enabled)
      void request("/event", { category: "interface", code: "ui-error" }).catch(
        () => {},
      );
  });
}
export async function renderDiagnosticsControl(root) {
  root.setAttribute("data-no-translate", "");
  let state;
  try {
    state = await request();
  } catch {
    root.textContent = L(
      "Не удалось открыть настройки диагностики.",
      "Could not load diagnostic settings.",
    );
    return;
  }
  if (!root.isConnected) return;
  enabled = state.enabled;
  root.innerHTML = `<h3>${L("Диагностика и конфиденциальность", "Diagnostics and privacy")}</h3><p>${L("Диагностика помогает находить ошибки и измерять скорость работы EFT GPS. Участие добровольное и по умолчанию отключено.", "Diagnostics help identify errors and measure EFT GPS performance. Participation is optional and off by default.")}</p><p>${L("Сохраняются только версия приложения, версия системы, категории ошибок и длительность операций. Не сохраняются скриншоты, координаты GPS, заметки, имена, пути к файлам, пароли и платёжные данные.", "Only the app version, OS version, error categories and operation durations are stored. Screenshots, GPS coordinates, notes, names, file paths, passwords and payment data are excluded.")}</p><label class="preference-row"><span><strong>${L("Я разрешаю сохранять техническую диагностику на этом компьютере", "I allow technical diagnostics to be stored on this computer")}</strong><small>${L("Не более 300 событий за последние 7 дней. Согласие можно отозвать в любой момент.", "Up to 300 events from the last 7 days. You can withdraw consent at any time.")}</small></span><input type="checkbox" data-diagnostic-consent ${enabled ? "checked" : ""}></label><p class="muted small">${L("Автоматическая отправка отключена: приватный сервис пока не подключён. Перед подключением потребуется отдельное согласие с указанием получателя.", "Automatic upload is off: the private service is not connected yet. Connecting it will require separate consent naming the recipient.")}</p><p class="small" data-diagnostic-count>${L("Сохранено событий: ", "Saved events: ")}${state.events}</p><button data-diagnostic-view>${L("Посмотреть отчёт", "View report")}</button> <button data-diagnostic-clear>${L("Удалить сохранённый отчёт", "Delete saved report")}</button>`;
  root.querySelector("[data-diagnostic-consent]").onchange = async (e) => {
    const input = e.currentTarget;
    input.disabled = true;
    try {
      const result = await request("/consent", {
        enabled: input.checked,
        policyVersion: state.policyVersion,
      });
      enabled = result.enabled;
      if (!enabled)
        root.querySelector("[data-diagnostic-count]").textContent =
          L("Сохранено событий: ", "Saved events: ") + "0";
    } catch {
      input.checked = enabled;
      toast(
        L(
          "Не удалось сохранить выбор. Диагностика не изменена.",
          "Could not save your choice. Diagnostics remain unchanged.",
        ),
      );
    } finally {
      input.disabled = false;
    }
  };
  root.querySelector("[data-diagnostic-view]").onclick = async () => {
    try {
      const report = await request("/report");
      modal(
        `<h2>${L("Технический отчёт", "Diagnostic report")}</h2><pre data-selectable style="white-space:pre-wrap;overflow:auto">${esc(JSON.stringify(report, null, 2))}</pre>`,
      );
    } catch {
      toast(L("Не удалось открыть отчёт", "Could not open report"));
    }
  };
  root.querySelector("[data-diagnostic-clear]").onclick = async () => {
    try {
      await request("/clear", {});
      root.querySelector("[data-diagnostic-count]").textContent =
        L("Сохранено событий: ", "Saved events: ") + "0";
      toast(L("Сохранённый отчёт удалён", "Saved report deleted"));
    } catch {
      toast(L("Не удалось удалить отчёт", "Could not delete report"));
    }
  };
}
