import { getMarkerStyle } from "./marker-style.js";
import { classicMapIcon, classicMarkerIcon } from "./map-icons-classic.js";
// EFT GPS vector markers; original aliases remain compatible with offline data.
import { markerTheme } from "./map-marker-theme.js";
import { asset } from "./data.js";
export const mapIconNames = {
  "container_bank-cash-register": "container_cash-register",
  "container_bank-safe": "container_safe",
  "container_buried-barrel-cache": "container_buried-barrel-cache",
  "container_cash-register": "container_cash-register",
  "container_cash-register-tar2-2": "container_cash-register",
  "container_civilian-body": "container_dead-scav",
  "container_dead-civilian": "container_dead-scav",
  "container_dead-scav": "container_dead-scav",
  container_drawer: "container_drawer",
  "container_duffle-bag": "container_duffle-bag",
  "container_festive-airdrop-supply-crate":
    "container_festive-airdrop-supply-crate",
  "container_grenade-box": "container_grenade-box",
  "container_ground-cache": "container_ground-cache",
  container_jacket: "container_jacket",
  "container_lab-technician-body": "container_dead-scav",
  "container_medbag-smu06": "container_medbag",
  container_medcase: "container_medcase",
  "container_medical-supply-crate": "container_crate",
  "container_pc-block": "container_pc-block",
  "container_plastic-suitcase": "container_plastic-suitcase",
  "container_pmc-body": "container_dead-scav",
  "container_ration-supply-crate": "container_crate",
  container_safe: "container_safe",
  "container_scav-body": "container_dead-scav",
  "container_shturmans-stash": "container_weapon-box",
  "container_technical-supply-crate": "container_crate",
  container_toolbox: "container_toolbox",
  "container_weapon-box": "container_weapon-box",
  "container_wooden-ammo-box": "container_wooden-ammo-box",
  "container_wooden-crate": "container_wooden-crate",
  extract_pmc: "extract_pmc",
  extract_scav: "extract_scav",
  extract_shared: "extract_shared",
  extract_transit: "extract_transit",
  hazard: "hazard",
  hazard_minefield: "hazard",
  hazard_mortar: "hazard_mortar",
  hazard_sniper: "hazard",
  key: "key",
  lock: "lock",
  loose_loot: "loose_loot",
  quest_item: "quest_item",
  quest_objective: "quest_objective",
  spawn_af: "spawn_af",
  "spawn_black-div": "spawn_black-div",
  spawn_bloodhound: "spawn_bloodhound",
  spawn_boss: "spawn_boss",
  "spawn_cultist-priest": "spawn_cultist-priest",
  spawn_pmc: "spawn_pmc",
  spawn_rogue: "spawn_rogue",
  spawn_scav: "spawn_scav",
  spawn_sniper_scav: "spawn_sniper_scav",
  stationarygun: "stationarygun",
  switch: "switch",
};

const themedIcon = (name) =>
  markerTheme.icons[name] ||
  markerTheme.icons[mapIconNames[name]] ||
  markerTheme.icons.loose_loot;
export function mapIcon(name) {
  if (getMarkerStyle() !== "classic" || name === "custom_pin")
    return themedIcon(name);
  const original =
    name === "btr"
      ? asset("/api/media/file/btr-icon.png")
      : name === "seasonal_document"
        ? asset("/api/media/file/season-1-doc-financial-documentation.webp")
        : classicMapIcon(name);
  return original === "/assets/fallback.svg" ? themedIcon(name) : original;
}
export function markerIconName(marker, map = {}) {
  switch (marker.group) {
    case "lootLoose":
      return markerTheme.categories[marker.category] || "loose_loot";
    case "lootContainers":
      return "container_" + (marker.lootContainer?.normalizedName || "other");
    case "extracts":
      return "extract_" + (marker.faction || "shared");
    case "transits":
      return "extract_transit";
    case "locks":
      return "lock";
    case "hazards":
      return ["sniper", "minefield"].includes(marker.hazardType)
        ? "hazard_" + marker.hazardType
        : "hazard";
    case "artillery":
      return "hazard_mortar";
    case "switches":
      return "switch";
    case "stationaryWeapons":
      return "stationarygun";
    case "quests":
      return marker.questItem ? "quest_item" : "quest_objective";
    case "seasonalDocuments":
      return marker.iconType
        ? "document_" + marker.iconType
        : "seasonal_document";
    case "btr":
      return "btr";
    case "spawns":
      return "spawn_" + spawnType(marker, map);
    default:
      return "loose_loot";
  }
}
export function markerIcon(marker, map = {}) {
  if (getMarkerStyle() === "classic") {
    const original = classicMarkerIcon(marker, map);
    if (original !== "/assets/fallback.svg") return original;
  }
  return themedIcon(markerIconName(marker, map));
}

export function spawnType(marker, map = {}) {
  let type = "scav";
  if (marker.categories?.includes("boss")) {
    const bosses = (map.bosses || []).filter((b) =>
      b.spawnLocations?.some((l) => l.spawnKey === marker.zoneName),
    );
    const special = [
      "bloodhound",
      "cultist-priest",
      "rogue",
      "black-div",
      "af",
    ];
    if (bosses.length)
      type =
        bosses.length === 1 && special.includes(bosses[0].normalizedName)
          ? bosses[0].normalizedName
          : "boss";
  } else if (
    marker.categories?.includes("player") &&
    marker.sides?.some((s) => s === "pmc" || s === "all")
  )
    type = "pmc";
  else if (marker.categories?.includes("sniper")) type = "sniper_scav";

  return type;
}
