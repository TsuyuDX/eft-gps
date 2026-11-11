export const mapColourKey = "eftgps-map-colour-v1";
export const mapColourDefaults = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
};
export function normalizeMapColour(v) {
  return Object.fromEntries(
    Object.entries(mapColourDefaults).map(([key, fallback]) => {
      const min = key === "hue" ? -180 : key === "saturation" ? 0 : 50,
        max = key === "hue" ? 180 : 180;
      return [
        key,
        typeof v?.[key] === "number" && Number.isFinite(v[key])
          ? Math.round(Math.min(max, Math.max(min, v[key])))
          : fallback,
      ];
    }),
  );
}
export function validMapColour(v) {
  return (
    v &&
    Object.keys(v).length === 4 &&
    Object.entries(normalizeMapColour(v)).every(([k, n]) => v[k] === n)
  );
}
