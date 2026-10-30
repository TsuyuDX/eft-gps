import { t } from "../core/localization.js";
import { markerSubtype } from "../core/map-options.js";
const groups = {
  lootLoose: "Предмет",
  lootContainers: "Контейнер",
  extracts: "Выход",
  transits: "Переход",
  spawns: "Точка появления",
  hazards: "Опасная зона",
  artillery: "Миномётный обстрел",
  quests: "Задание",
  locks: "Ключ / дверь",
  switches: "Переключатель",
  stationaryWeapons: "Стационарное оружие",
  seasonalDocuments: "Сезонный документ",
  btr: "БТР",
};
const plain = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function markerPresentation(marker, map = {}) {
  const kind =
    markerSubtype(marker, map)?.label || groups[marker.group] || "Метка";
  const name = plain(marker.title || marker.name || kind);
  const detail = plain(
    marker.description || marker.objDescription || marker.details,
  );
  const faction = { pmc: "ЧВК", scav: "Дикие", shared: "Совместный выход" }[
    marker.faction
  ];
  const description = [
    groups[marker.group] || kind,
    kind !== groups[marker.group] ? kind : "",
    detail,
    faction,
  ]
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map((value) => t(value))
    .join(" · ")
    .slice(0, 220);
  return {
    name,
    description,
    label: ["extracts", "transits"].includes(marker.group) ? name : "",
  };
}
export function gpsPointerSvg(style, { secret = false } = {}) {
  if (secret)
    return '<svg class="gps-arrow gps-index-arrow" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="index-nav-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#69c7ff"/><stop offset="1" stop-color="#1764ed"/></linearGradient></defs><path class="gps-index-cone" d="M20 20 4 1Q20-6 36 1Z"/><circle class="gps-index-base" cx="20" cy="22" r="12"/><path class="gps-index-pointer" d="M20 3 33 33 20 26 7 33Z"/><path class="gps-index-facet" d="M20 3v23l13 7Z"/></svg>';

  if (style === "classic")
    return '<svg class="gps-arrow" viewBox="0 0 40 40" aria-hidden="true"><path class="gps-pointer-shadow" d="M20 3 34 35 20 28 6 35Z"/><path class="gps-classic-pointer" d="M20 3 34 35 20 28 6 35Z"/><path class="gps-classic-spine" d="M20 12v16"/></svg>';
  return '<svg class="gps-arrow" viewBox="0 0 40 40" aria-hidden="true"><circle class="gps-new-ring" cx="20" cy="23" r="14"/><path class="gps-pointer-shadow" d="m20 2 11 26-11-5-11 5Z"/><path class="gps-new-pointer" d="m20 2 11 26-11-5-11 5Z"/><circle class="gps-new-dot" cx="20" cy="23" r="3"/></svg>';
}
