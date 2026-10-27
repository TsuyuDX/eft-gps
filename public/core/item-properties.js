import { localeCode } from "./localization.js";
export const extraPropertyLabels = {
  fragmentationChance: "Вероятность фрагментации, %",
  penetrationChance: "Вероятность пробития, %",
  projectileCount: "Снарядов в патроне",
  tracer: "Трассирующий",
  tracerColor: "Цвет трассера",
  repairCost: "Стоимость ремонта",
  effectiveDistance: "Эффективная дальность, м",
  sightingRange: "Прицельная дальность, м",
  ergoPenalty: "Изменение эргономики, %",
  speedPenalty: "Изменение скорости, %",
  turnPenalty: "Изменение скорости поворота, %",
  class: "Класс брони",
  armorType: "Тип брони",
  material: "Материал",
  bluntThroughput: "Запреградный урон, %",
  slashDamage: "Рубящий урон",
  stabDamage: "Колющий урон",
  recoilModifier: "Изменение отдачи, %",
  malfunctionChance: "Вероятность неисправности, %",
  loadModifier: "Модификатор заряжания",
  ammoCheckModifier: "Модификатор проверки патронов",
  intensity: "Интенсивность",
  ambientVolume: "Громкость окружения",
  distortion: "Искажение звука",
  distanceModifier: "Множитель дальности звука",
  units: "Ресурс",
  type: "Тип",
  fuse: "Задержка взрывателя, с",
  fragments: "Количество осколков",
  maxExplosionDistance: "Максимальный радиус взрыва, м",
};
const percentages = new Set([
  "fragmentationChance",
  "penetrationChance",
  "ergoPenalty",
  "speedPenalty",
  "turnPenalty",
  "bluntThroughput",
  "recoilModifier",
  "malfunctionChance",
]);
const values = {
  UHMWPE: "СВМПЭ",
  Aramid: "Арамид",
  Titan: "Титан",
  ArmoredSteel: "Броневая сталь",
  Combined: "Комбинированный",
  Aluminium: "Алюминий",
  Ceramic: "Керамика",
  red: "Красный",
  tracerRed: "Красный",
  green: "Зелёный",
  tracerGreen: "Зелёный",
  yellow: "Жёлтый",
  Grenade: "Осколочная граната",
  Smoke: "Дымовая граната",
  Flashbang: "Светошумовая граната",
  "Impact Grenade": "Ударная граната",
};
export function propertyValue(key, value) {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (typeof value === "number")
    return new Intl.NumberFormat(localeCode(), { maximumFractionDigits: 4 }).format(
      percentages.has(key) ? value * 100 : value,
    );
  if (key === "caliber")
    return String(value)
      .replace(/^Caliber/, "")
      .replaceAll("x", "×");
  return ["material", "tracerColor", "type"].includes(key)
    ? values[value] || value
    : value;
}
