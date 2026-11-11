// Preview values are image adjustments, not a translation of game/driver scales.
export const graphicsKey = "eftgps-graphics-v1";
export const parameters = [
  ["brightness", "Яркость", 50, 160, 1, 100, "%"],
  ["contrast", "Контрастность", 50, 160, 1, 100, "%"],
  ["saturation", "Насыщенность", 0, 180, 1, 100, "%"],
  ["gamma", "Гамма", 0.5, 2, 0.01, 1, ""],
  ["temperature", "Температура", -50, 50, 1, 0, ""],
  ["sharpness", "Резкость", 0, 50, 1, 0, "%"],
  ["intensity", "Интенсивность", 0, 100, 1, 100, "%"],
];
export const original = Object.fromEntries(
  parameters.map(([key, , , , , value]) => [key, value]),
);
export const builtinPresets = [
  { id: "original", name: "Оригинал", values: { ...original } },
  {
    id: "brighter",
    name: "Светлее",
    values: { ...original, brightness: 110, gamma: 1.2, contrast: 103 },
  },
  {
    id: "darker",
    name: "Темнее",
    values: { ...original, brightness: 90, gamma: 0.92, contrast: 105 },
  },
  {
    id: "visibility",
    name: "Повышенная видимость",
    values: {
      ...original,
      brightness: 108,
      gamma: 1.25,
      saturation: 95,
      sharpness: 10,
    },
  },
  {
    id: "natural",
    name: "Естественные цвета",
    values: { ...original, contrast: 103, saturation: 95, temperature: 2 },
  },
  {
    id: "cinema",
    name: "Кинематографический",
    values: {
      ...original,
      contrast: 115,
      saturation: 80,
      temperature: -8,
      intensity: 80,
    },
  },
];
export const locations = [
  "Лес",
  "Таможня",
  "Развязка",
  "Берег",
  "Улицы Таркова",
  "Лаборатория",
  "Завод",
  "Маяк",
  "Резерв",
  "Эпицентр",
  "Другая локация",
];
export function normalizeAdjustments(value = {}) {
  return Object.fromEntries(
    parameters.map(([key, , min, max, step, fallback]) => {
      const n = Number(value[key]);
      return [
        key,
        Number.isFinite(n)
          ? Math.round(Math.max(min, Math.min(max, n)) / step) * step
          : fallback,
      ];
    }),
  );
}
export function normalizeGraphics(value) {
  const result = {
    version: 1,
    values: normalizeAdjustments(value?.values),
    presets: [],
  };
  if (Array.isArray(value?.presets))
    for (const preset of value.presets.slice(0, 20)) {
      if (
        !preset ||
        !/^[a-z0-9-]{1,64}$/.test(preset.id) ||
        !String(preset.name || "").trim()
      )
        continue;
      if (
        result.presets.some((p) => p.id === preset.id) ||
        builtinPresets.some((p) => p.id === preset.id)
      )
        continue;
      result.presets.push({
        id: preset.id,
        name: String(preset.name).trim().slice(0, 60),
        values: normalizeAdjustments(preset.values),
      });
    }
  return result;
}
export function validGraphics(value) {
  if (
    !value ||
    value.version !== 1 ||
    !value.values ||
    !Array.isArray(value.presets) ||
    value.presets.length > 20
  )
    return false;
  const validValues = (v) =>
    v &&
    Object.keys(v).length === parameters.length &&
    parameters.every(
      ([k, , min, max]) =>
        typeof v[k] === "number" &&
        Number.isFinite(v[k]) &&
        v[k] >= min &&
        v[k] <= max,
    );
  return (
    validValues(value.values) &&
    value.presets.every(
      (p) =>
        p &&
        /^[a-z0-9-]{1,64}$/.test(p.id) &&
        typeof p.name === "string" &&
        p.name.trim().length > 0 &&
        p.name.length <= 60 &&
        validValues(p.values),
    ) &&
    new Set(value.presets.map((p) => p.id)).size === value.presets.length
  );
}
export function filterValues(raw) {
  const v = normalizeAdjustments(raw),
    contrast = v.contrast / 100;
  const sharp = v.sharpness / 100;
  return {
    exponent: 1 / v.gamma,
    slope: (contrast * v.brightness) / 100,
    intercept: ((0.5 - 0.5 * contrast) * v.brightness) / 100,
    saturation: v.saturation / 100,
    red: 1 + v.temperature / 500,
    blue: 1 - v.temperature / 500,
    kernel: [0, -sharp, 0, -sharp, 1 + 4 * sharp, -sharp, 0, -sharp, 0].join(
      " ",
    ),
    intensity: v.intensity / 100,
  };
}
