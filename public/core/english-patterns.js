const templates = [
  ["__V0__-й этаж", "Floor __V0__"],
  ["__V0__ результатов · __V1__ / __V2__", "__V0__ results · __V1__ / __V2__"],
  ["Уровень __V1__", "Level __V1__"],
  ["Уровень __V0__", "Level __V0__"],
  ["Ур. __V1__", "Lvl. __V1__"],
  ["Репутация __V2__", "Reputation __V2__"],
  ["Оборот __V3__", "Turnover __V3__"],
  [
    "__V1__ предметов. Ассортимент из общего снимка PvP.",
    "__V1__ items. Inventory uses the shared PvP snapshot.",
  ],
  [
    "__V0__ предметов · цены из локального снимка",
    "__V0__ items · prices from the saved snapshot",
  ],
  ["__V0__ · уровень __V1____V2__", "__V0__ · level __V1____V2__"],
  ["Открывается заданием: __V2__", "Unlocked by quest: __V2__"],
  ["__V1__ × __V2__ · __V3__ кг", "__V1__ × __V2__ · __V3__ kg"],
  [
    "Снимок цен: __V11__. Свежие цены появляются после обновления базы.",
    "Price snapshot: __V11__. Update the database for newer prices.",
  ],
  ["__V4__ · __V5__ МБ", "__V4__ · __V5__ MB"],
  ["__V0__ сек. назад", "__V0__ sec ago"],
  [
    "Моя позиция · __V0__ сек. назад · высота __V1__",
    "My position · __V0__ sec ago · height __V1__",
  ],
  [
    "⌖ Я · __V0__ сек. назад · Y __V1____V2__",
    "⌖ Me · __V0__ sec ago · Y __V1____V2__",
  ],
  ["Прохождение: __V8__", "Walkthrough: __V8__"],
  ["Ещё __V0__. Уточните поиск.", "__V0__ more. Refine your search."],
  ["Выбрано: __V0__", "Selected: __V0__"],
  ["__V6__ игроков", "__V6__ players"],
  ["Сторона: __V0__", "Faction: __V0__"],
  ["Показано __V0__ меток", "Showing __V0__ markers"],
  ["__V6__ требований", "__V6__ requirements"],
  ["Собрано __V11__", "Collected __V11__"],
  ["Уровень __V5__", "Level __V5__"],
  ["__V1__ очков", "__V1__ points"],
  [
    "Положительные эффекты расходуют очки, отрицательные дают очки. Итог должен быть не ниже нуля.__V0__",
    "Positive effects cost points; negative effects grant points. The total must not be below zero.__V0__",
  ],
  [
    "__V1__ авторских прохождений из __V2__ заданий. Для __V3__ заданий без отдельного прохождения доступен краткий план по сохранённым целям.",
    "__V1__ authored walkthroughs for __V2__ quests. A quick objective-based plan is available for the remaining __V3__ quests.",
  ],
  ["Сохранена __V1__.", "Saved on __V1__."],
  [
    "Недоступных изображений в отчёте базы: __V3__. Если источник удалил иллюстрацию, приложение показывает пояснение. Работа карт, целей и прогресса от этого не зависит.",
    "Unavailable images in the database report: __V3__. If an image is no longer available, the application explains why. Maps, objectives and progress still work.",
  ],
  ["__V0__: __V1____V2__ репутации", "__V0__: __V1____V2__ reputation"],
  ["Открывается торговец: __V0__", "Trader unlocked: __V0__"],
  ["Открывается покупка · __V0__ __V1__", "Purchase unlocked · __V0__ __V1__"],
  ["ур. __V0__", "lvl. __V0__"],
  ["Открывается рецепт · __V0__ __V1__", "Craft unlocked · __V0__ __V1__"],
  ["Уровень __V6__", "Level __V6__"],
  ["__V7__ опыта", "__V7__ XP"],
  ["Уровень персонажа: __V16__", "Player level: __V16__"],
  ["__V21__ опыта", "__V21__ XP"],
  ["Выбранная точка · __V0__", "Selected location · __V0__"],
  ["Иллюстрации (__V0__)", "Images (__V0__)"],
  ["__V0__ · изображение недоступно у источника", "__V0__ · image unavailable"],
  [
    "__V0__ заданий · прогресс хранится отдельно для PvP и PvE",
    "__V0__ quests · separate progress for PvP and PvE",
  ],
  ["Завершено: __V1__", "Completed: __V1__"],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compiled = templates.map(([source, target]) => {
  let cursor = 0,
    pattern = "^",
    slots = [];
  for (const match of source.matchAll(/__V(\d+)__/g)) {
    pattern +=
      escape(source.slice(cursor, match.index)).replaceAll(" ", "\\s+") +
      "([\\s\\S]*?)";
    slots.push(match[1]);
    cursor = match.index + match[0].length;
  }
  pattern += escape(source.slice(cursor)).replaceAll(" ", "\\s+") + "$";
  return { regex: new RegExp(pattern), target, slots };
});
export function translatePattern(value) {
  for (const { regex, target, slots } of compiled) {
    const match = value.match(regex);
    if (!match) continue;
    const values = Object.fromEntries(
      slots.map((slot, i) => [slot, match[i + 1]]),
    );
    return target.replace(/__V(\d+)__/g, (_, slot) => values[slot] || "");
  }
  return value;
}
