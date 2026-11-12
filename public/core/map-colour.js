import {textPair} from "./localization.js";
import { db, asset } from "./data.js";
import { language } from "./localization.js";
import { esc } from "./ui.js";
import { readWindowSetting, writeWindowSetting } from "./window-settings.js";
import {
  mapColourKey,
  mapColourDefaults,
  normalizeMapColour,
} from "./map-colour-model.js";
export function getMapColour() {
  try {
    return normalizeMapColour(JSON.parse(readWindowSetting(mapColourKey)));
  } catch {
    return { ...mapColourDefaults };
  }
}
export function mapColourFilter(v) {
  v = normalizeMapColour(v);
  if(Object.keys(mapColourDefaults).every(k=>v[k]===mapColourDefaults[k]))return "none";
  return `brightness(${v.brightness}%) contrast(${v.contrast}%) saturate(${v.saturation}%) hue-rotate(${v.hue}deg)`;
}
export function bindMapColour(root, signal) {
  const apply = (event) =>
    root
      .querySelector("#map-canvas")
      ?.style.setProperty(
        "--map-colour-filter",
        mapColourFilter(event?.detail || getMapColour()),
      );
  apply();
  window.addEventListener("map-colour-changed", apply, { signal });
}
export function renderMapColourControls(root) {
  const tx = textPair;
  let values = getMapColour();
  const controller = new AbortController(),
    signal = controller.signal;
  document.querySelector("#modal")?.addEventListener(
    "close",
    () => {
      controller.abort();
      window.dispatchEvent(new Event("map-colour-changed"));
    },
    { once: true, signal },
  );
  root.innerHTML = `<div data-no-translate><h3>${tx("Цветокоррекция карты", "Map colour correction")}</h3><p class="muted small">${tx("Меняет только фон карты. Метки, подписи и зоны опасностей сохраняют свои цвета. Настройки общие для всех локаций.", "Changes the map background only. Markers, labels and hazard zones keep their colours. Settings apply to all locations.")}</p><label>${tx("Карта для сравнения", "Comparison map")}<select data-map-colour-location>${db.maps.map((x) => `<option value="${x.normalizedName}">${esc(x.name)}</option>`).join("")}</select></label><div class="map-colour-compare"><img data-map-colour-before alt="${tx("До", "Before")}" draggable="false"><div data-map-colour-clip><img data-map-colour-after alt="${tx("После", "After")}" draggable="false"></div><span data-map-colour-divider></span><b class="graphics-before-label">${tx("До", "Before")}</b><b class="graphics-after-label">${tx("После", "After")}</b><input type="range" min="0" max="100" value="50" data-map-colour-split aria-label="${tx("Сравнение карты до и после", "Map before and after comparison")}"></div><div class="map-colour-sliders">${[
    ["brightness", tx("Яркость", "Brightness"), 50, 180],
    ["contrast", tx("Контрастность", "Contrast"), 50, 180],
    ["saturation", tx("Насыщенность", "Saturation"), 0, 180],
    ["hue", tx("Оттенок", "Hue"), -180, 180],
  ]
    .map(
      ([key, label, min, max]) =>
        `<label class="graphics-slider"><span>${label}<output data-map-colour-value="${key}"></output></span><input data-map-colour="${key}" type="range" min="${min}" max="${max}" step="1" value="${values[key]}" aria-label="${label}"></label>`,
    )
    .join(
      "",
    )}</div><button data-map-colour-reset>${tx("Сбросить цвет карты", "Reset map colours")}</button></div>`;
  const $ = (s) => root.querySelector(s);
  function split() {
    const n = $("[data-map-colour-split]").value;
    $("[data-map-colour-clip]").style.clipPath = `inset(0 0 0 ${n}%)`;
    $("[data-map-colour-divider]").style.left = n + "%";
  }
  function draw() {
    for (const [k, v] of Object.entries(values)) {
      $(`[data-map-colour-value="${k}"]`).textContent =
        v + (k === "hue" ? "°" : "%");
      $(`[data-map-colour="${k}"]`).value = v;
    }
    $("[data-map-colour-after]").style.filter = mapColourFilter(values);
    window.dispatchEvent(
      new CustomEvent("map-colour-changed", { detail: values }),
    );
  }
  function choose() {
    const map = db.maps.find(
      (x) => x.normalizedName === $("[data-map-colour-location]").value,
    );
    for (const e of root.querySelectorAll(
      "[data-map-colour-before],[data-map-colour-after]",
    ))
      e.src = asset(map?.preview);
  }
  root.querySelectorAll("[data-map-colour]").forEach((input) => {
    input.addEventListener(
      "input",
      () => {
        values = normalizeMapColour({
          ...values,
          [input.dataset.mapColour]: Number(input.value),
        });
        draw();
      },
      { signal },
    );
    input.addEventListener(
      "change",
      () => writeWindowSetting(mapColourKey, JSON.stringify(values)),
      { signal },
    );
  });
  $("[data-map-colour-location]").addEventListener("change", choose, {
    signal,
  });
  $("[data-map-colour-split]").addEventListener("input", split, { signal });
  $("[data-map-colour-reset]").addEventListener(
    "click",
    () => {
      values = { ...mapColourDefaults };
      draw();
      writeWindowSetting(mapColourKey, JSON.stringify(values));
    },
    { signal },
  );
  choose();
  split();
  draw();
}
