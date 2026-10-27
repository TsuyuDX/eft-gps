import { spawnType } from "./map-icons.js";
const factions = { pmc: "ЧВК", scav: "Дикие", shared: "Совместные" };
const spawns = {
  pmc: "ЧВК",
  scav: "Дикие",
  boss: "Боссы",
  sniper_scav: "Дикие-снайперы",
  rogue: "Отступники",
  "cultist-priest": "Сектанты",
  bloodhound: "Кровососы",
  "black-div": "Black Division",
  af: "AF",
};
export function markerSubtype(marker, map) {
  switch (marker.group) {
    case "lootContainers":
      return {
        id: marker.lootContainer?.normalizedName || "other",
        label: marker.lootContainer?.name || "Другие контейнеры",
      };
    case "lootLoose":
      return {
        id: marker.category || "other",
        label: marker.category || "Другой лут",
      };
    case "extracts":
      return {
        id: marker.faction || "shared",
        label: factions[marker.faction || "shared"] || marker.faction,
      };
    case "spawns": {
      const id = spawnType(marker, map);
      return { id, label: spawns[id] || id };
    }
    case "hazards":
      return {
        id: marker.hazardType || "other",
        label:
          marker.hazardType === "sniper"
            ? "Снайперы"
            : marker.hazardType === "minefield"
              ? "Минные поля"
              : marker.name || "Другие опасности",
      };
    case "quests":
      return {
        id: marker.questItem ? "item" : "objective",
        label: marker.questItem ? "Квестовые предметы" : "Цели заданий",
      };
    case "seasonalDocuments":
      return {
        id: marker.iconType || "other",
        label: marker.label || "Другие документы",
      };
    default:
      return null;
  }
}
export function markerGroups(markers, map) {
  const groups = new Map();
  for (const marker of markers) {
    const subtype = markerSubtype(marker, map);
    if (!subtype) continue;
    const key = marker.group + "|" + subtype.id;
    if (!groups.has(marker.group)) groups.set(marker.group, new Map());
    const entries = groups.get(marker.group);
    if (!entries.has(key))
      entries.set(key, { ...subtype, key, marker, count: 0 });
    entries.get(key).count++;
  }
  return groups;
}
