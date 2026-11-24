import { readWindowSetting, writeWindowSetting } from "./window-settings.js";
import { textPair as L } from "./localization.js";
const key = "eftgps-appearance-v1";
export function appearance() {
  try {
    const x = JSON.parse(readWindowSetting(key));
    return {
      scale: [90, 100, 110, 125].includes(x?.scale) ? x.scale : 100,
      font: ["system", "arial", "tahoma"].includes(x?.font) ? x.font : "system",
      animations: x?.animations !== false,
    };
  } catch {
    return { scale: 100, font: "system", animations: true };
  }
}
export function applyAppearance() {
  const x = appearance();
  document.body.style.zoom = x.scale / 100;
  document.documentElement.style.setProperty("--ui-scale", x.scale / 100);
  document.body.style.fontFamily = {
    system: '"Segoe UI Variable Text","Segoe UI",Arial,sans-serif',
    arial: "Arial,sans-serif",
    tahoma: "Tahoma,sans-serif",
  }[x.font];
  document.documentElement.classList.toggle("no-animation", !x.animations);
}
export function renderAppearance(root) {
  const draw = () => {
    const x = appearance();
    root.innerHTML = `<h3>${L("Размер и шрифт", "Size and font")}</h3><label class="preference-row"><span>${L("Размер интерфейса", "Interface size")}</span><select data-scale>${[90, 100, 110, 125].map((n) => `<option value="${n}" ${n === x.scale ? "selected" : ""}>${n}%</option>`).join("")}</select></label><label class="preference-row"><span>${L("Шрифт", "Font")}</span><select data-font><option value="system">Segoe UI</option><option value="arial">Arial</option><option value="tahoma">Tahoma</option></select></label><label class="preference-row"><span>${L("Плавные анимации", "Smooth animations")}</span><input data-animations type="checkbox" ${x.animations ? "checked" : ""}></label><button data-reset-appearance>${L("Восстановить оформление", "Restore appearance")}</button>`;
    root.querySelector("[data-font]").value = x.font;
    for (const field of root.querySelectorAll("select,input"))
      field.onchange = () => {
        writeWindowSetting(
          key,
          JSON.stringify({
            scale: Number(root.querySelector("[data-scale]").value),
            font: root.querySelector("[data-font]").value,
            animations: root.querySelector("[data-animations]").checked,
          }),
        );
        applyAppearance();
      };
    root.querySelector("[data-reset-appearance]").onclick = () => {
      writeWindowSetting(
        key,
        JSON.stringify({ scale: 100, font: "system", animations: true }),
      );
      applyAppearance();
      draw();
    };
  };
  draw();
}
