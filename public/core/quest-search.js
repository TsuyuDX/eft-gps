export const normalizeQuestSearch = (value) =>
  String(value || "")
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function matchesQuestSearch(text, query) {
  const words = normalizeQuestSearch(query).split(" ").filter(Boolean);
  return words.every(
    (word) => text.startsWith(word) || text.includes(" " + word),
  );
}
