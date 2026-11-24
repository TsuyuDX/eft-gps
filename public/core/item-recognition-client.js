import { overlayMode } from "./overlay-mode.js";
import { textPair as L } from "./localization.js";
import { esc, money, img } from "./ui.js";
import { db } from "./data.js";
const endpoint = "/api/item-recognition";
async function request(config) {
  const r = await fetch(
    endpoint,
    config
      ? {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        }
      : {},
  );
  if (!r.ok)
    throw Error(L("Распознавание недоступно", "Recognition unavailable"));
  return r.json();
}
export async function renderRecognitionSettings(root) {
  root.innerHTML =
    "<h3>" +
    L("Распознавание предметов · Beta", "Item recognition · Beta") +
    "</h3><p>" +
    L(
      "Выключено по умолчанию. Анализируются только новые игровые снимки из GPS. Нужны включённый GPS и русский или английский компонент OCR Windows. Изображения остаются на компьютере.",
      "Disabled by default. Only new GPS gameplay captures are analyzed. Enable GPS and install a Russian or English Windows OCR language. Images stay on this computer.",
    ) +
    "</p>";
  try {
    const s = await request();
    if (!root.isConnected) return;
    const c = s.config;
    root.insertAdjacentHTML(
      "beforeend",
      `<label class="preference-row"><span>${L("Распознавать предметы", "Recognize items")}</span><input type="checkbox" data-ocr="enabled" ${c.enabled ? "checked" : ""}></label><label class="preference-row"><span>${L("Интервал анализа, секунд", "Analysis interval, seconds")}</span><input type="number" min="5" max="60" data-ocr="interval" value="${c.interval}"></label><label class="preference-row"><span>${L("Показывать уведомление, секунд", "Notification duration, seconds")}</span><input type="number" min="3" max="30" data-ocr="duration" value="${c.duration}"></label><label class="preference-row"><span>${L("Показывать цены", "Show prices")}</span><input type="checkbox" data-ocr="prices" ${c.prices ? "checked" : ""}></label><label class="preference-row"><span>${L("Предупреждать о заданиях", "Warn about quest items")}</span><input type="checkbox" data-ocr="quests" ${c.quests ? "checked" : ""}></label><label class="preference-row"><span>${L("Уровень персонажа", "Character level")}</span><input type="number" min="0" max="79" data-ocr="playerLevel" value="${c.playerLevel}"></label><h4>${L("Доступные торговцы", "Unlocked traders")}</h4><p class="small muted">${L("Отметьте открытых торговцев. Без подтверждения доступа рекомендации будут условными.", "Select traders you have unlocked. Recommendations are conditional until access is confirmed.")}</p><div class="row wrap">${["prapor", "therapist", "skier", "peacekeeper", "mechanic", "ragman", "jaeger", "fence", "ref"].map((id) => `<label><input type="checkbox" data-ocr-trader="${id}" ${c.traders.includes(id) ? "checked" : ""}> ${esc(db.lookup?.traders?.[id]?.name || id)}</label>`).join("")}</div><p data-ocr-status role="status">${esc(s.error || L("Настройки сохраняются автоматически", "Settings save automatically"))}</p>`,
    );
    let saving = Promise.resolve();
    for (const input of root.querySelectorAll("input"))
      input.onchange = () => {
        if (!input.checkValidity()) {
          input.reportValidity();
          return;
        }
        const value = { ...c };
        for (const i of root.querySelectorAll("[data-ocr]"))
          value[i.dataset.ocr] =
            i.type === "checkbox" ? i.checked : Number(i.value);
        value.traders = [
          ...root.querySelectorAll("[data-ocr-trader]:checked"),
        ].map((i) => i.dataset.ocrTrader);
        saving = saving
          .catch(() => {})
          .then(() => request(value))
          .then((s) => {
            Object.assign(c, s.config);
            const status = root.querySelector("[data-ocr-status]");
            if (status?.isConnected)
              status.textContent = L("Сохранено", "Saved");
            window.dispatchEvent(new Event("item-recognition-changed"));
          })
          .catch((e) =>
            root
              .querySelector("[data-ocr-status]")
              ?.replaceChildren(document.createTextNode(e.message)),
          );
      };
    for (const input of root.querySelectorAll('input[type="number"]'))
      input.oninput = () => {
        if (input.checkValidity()) input.onchange();
      };
  } catch (e) {
    root.insertAdjacentHTML(
      "beforeend",
      '<p role="status">' + esc(e.message) + "</p>",
    );
  }
}
export function itemNotificationHtml(r) {
  const local = db.items.find((x) => x.normalizedName === r.slug);
  const q = r.price?.quotes;
  return `${img(local?.iconLink || r.icon, "")}<div><strong>${esc(local?.name || r.name)}</strong>${r.quests?.length ? '<p class="item-keep">' + L("Нужен для задания — не продавай", "Needed for a quest — do not sell") + "</p>" + r.quests.map((x) => "<small>" + esc(x.name) + " × " + esc(x.count) + "</small>").join("<br>") : ""}${r.price ? (r.price.error ? '<p class="muted">' + L("Актуальная цена недоступна", "Current price is unavailable") + "</p>" : `<p>${L("Барахолка, до комиссии", "Flea market, before fees")}: ${q?.flea ? money(q.flea) : "—"}</p><small>${q?.fleaLevel != null ? (q.fleaAvailable ? L("Доступ по указанному уровню; проверьте условия рынка", "Level requirement met; verify market conditions") : L("Нужен уровень ", "Required level ") + q.fleaLevel) : L("Условия доступа к Барахолке не подтверждены", "Flea access requirements are unconfirmed")}</small><p>${L("Лучший торговец", "Best trader")}: ${esc(q?.best?.vendor?.name || "—")} · ${money(q?.best?.priceRUB)}</p><small>${L("Среди отмеченных доступных", "Among selected unlocked traders")}: ${esc(q?.available?.vendor?.name || "—")} · ${money(q?.available?.priceRUB)}</small><p class="small">${q?.available ? L("Выгоднее среди доступных торговцев: ", "Best among unlocked traders: ") + esc(q.available.vendor.name) : L("Отметьте доступных торговцев в настройках", "Select unlocked traders in settings")}</p><p class="muted small">${r.price.stale ? L("Сохранённые цены · могут устареть", "Cached prices · may be stale") : L("Tarkov.dev · комиссия и доступ к Барахолке требуют проверки", "Tarkov.dev · verify fees and flea access")}${r.price.at ? " · " + esc(new Date(r.price.at).toLocaleTimeString()) : ""}</p>`) : ""}</div>`;
}
export function initializeItemRecognition() {
  if (overlayMode && window.chrome?.webview) return;
  const box = document.createElement("aside");
  box.className = "item-price-toast";
  box.setAttribute("role", "status");
  box.hidden = true;
  document.body.append(box);
  let timer,
    last = 0,
    hide;
  async function poll() {
    try {
      const s = await request();
      const r = s.result;
      if (s.config.enabled && r && r.at !== last && r.expiresAt > Date.now()) {
        last = r.at;
        box.innerHTML = itemNotificationHtml(r);
        const icon = box.querySelector("img");
        if (window.chrome?.webview && icon) {
          void icon
            .decode()
            .then(() => {
              const canvas = document.createElement("canvas");
              canvas.width = 64;
              canvas.height = 64;
              canvas.getContext("2d").drawImage(icon, 0, 0, 64, 64);
              window.chrome.webview.postMessage(
                "item-icon:" + canvas.toDataURL("image/png").split(",")[1],
              );
            })
            .catch(() => {});
        }
        box.hidden = false;
        clearTimeout(hide);
        hide = setTimeout(
          () => (box.hidden = true),
          Math.max(0, r.expiresAt - Date.now()),
        );
      }
      if (!s.config.enabled) box.hidden = true;
    } catch {}
    timer = setTimeout(poll, 3000);
  }
  window.addEventListener(
    "pagehide",
    () => {
      clearTimeout(timer);
      clearTimeout(hide);
    },
    { once: true },
  );
  void poll();
}
