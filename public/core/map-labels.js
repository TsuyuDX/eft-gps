const floors = {
  Underground: "Подземный уровень",
  Tunnels: "Тоннели",
  Garage: "Гараж",
  Infirmary: "Медпункт",
  Helipad: "Вертолётная площадка",
  "Gym/Canteen": "Спортзал и столовая",
  "Accommodation (lower)": "Жилая палуба · нижний уровень",
  "Accommodation (mid)": "Жилая палуба · средний уровень",
  "Accommodation (upper)": "Жилая палуба · верхний уровень",
  "Officers' Deck": "Офицерская палуба",
  "Stairs (blocked)": "Лестницы · проход закрыт",
  Bridge: "Ходовой мостик",
  "Bridge Roof": "Крыша мостика",
  "Control Room": "Пост управления",
  "Engine Room": "Машинное отделение",
  "Engine Room (upper)": "Машинное отделение · верхний уровень",
  "Fuel Pumps (lower)": "Топливные насосы · нижний уровень",
  "Fuel Pumps": "Топливные насосы",
  "Storage/Security": "Склад и охрана",
  Bunkers: "Бункеры",
  "Second Level": "Второй уровень",
  Technical: "Технический уровень",
};
export function floorLabel(name) {
  const numbered = /^(\d+)(?:st|nd|rd|th) Floor$/.exec(name);
  return numbered ? `${numbered[1]}-й этаж` : floors[name] || name;
}
