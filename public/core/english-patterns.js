import { templates } from "../locales/templates.js";

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compiled = templates.map(({ source, ru, en }) => {
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
  return { source, regex: new RegExp(pattern), ru, en, slots };
});
// Без русских переопределений шаблоны не проверяются при отрисовке карты.
const russianOverrides = compiled.filter((x) => x.ru !== x.source);
export function translatePattern(value, locale = "en") {
  for (const { regex, ru, en, slots } of locale === "ru"
    ? russianOverrides
    : compiled) {
    const target = locale === "ru" ? ru : en;
    const match = value.match(regex);
    if (!match) continue;
    const values = Object.fromEntries(
      slots.map((slot, i) => [slot, match[i + 1]]),
    );
    return target.replace(/__V(\d+)__/g, (_, slot) => values[slot] || "");
  }
  return value;
}
