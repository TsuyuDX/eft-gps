let bundle = null;
export let eventContentState = { phase: "idle", lastSuccess: null };
export const eventRevision = () => bundle?.revision || "";
export function acceptEventContent(result) {
  eventContentState = result.state || eventContentState;
  if (!result.data?.quests || result.data.revision === bundle?.revision)
    return false;
  bundle = result.data;
  return true;
}
const entries = (locale) =>
  Object.values(bundle?.quests?.[locale === "en" ? "en" : "ru"] || {});
export function eventQuestDetail(url, locale) {
  const match = url.match(/^(pve\/)?quests\/(halloween-[a-z0-9-]+)\.json$/);
  const q =
    match && bundle?.quests?.[locale === "en" ? "en" : "ru"]?.[match[2]];
  return q && (!match[1] || q.inAllModes) ? { quest: q } : null;
}
function summary(q) {
  return {
    name: q.name,
    normalizedName: q.normalizedName,
    trader: q.trader?.normalizedName || "",
    minPlayerLevel: q.minPlayerLevel,
    type: "side",
    iconLink: q.iconLink,
    isEventQuest: true,
    eventSlug: "halloween-2026",
    kappaRequired: false,
    lightkeeperRequired: false,
    isPastEventQuest: false,
  };
}
function text(v) {
  return typeof v === "string"
    ? v
    : Array.isArray(v)
      ? v.map(text).join(" ")
      : v && typeof v === "object"
        ? text(
            v.text ||
              v.children ||
              v.content ||
              v.items ||
              v.rows ||
              v.cells ||
              "",
          )
        : "";
}
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function mergeEventContent(url, locale, base) {
  const quests = entries(locale).filter(
    (q) => !url.startsWith("pve/") || q.inAllModes,
  );
  if (!quests.length) return base;
  if (/^(regular|pve)\/quests\.json$/.test(url)) {
    const rows = new Map(base.map((q) => [q.normalizedName, q]));
    for (const q of quests) rows.set(q.normalizedName, summary(q));
    return [...rows.values()];
  }
  if (/^(regular|pve)\/quest-search\.json$/.test(url)) {
    const result = { ...base };
    for (const q of quests)
      result[q.normalizedName] = {
        name: q.name,
        trader: q.trader?.name || "",
        traderSlug: q.trader?.normalizedName || "",
        icon: q.iconLink,
        maps: q.objectives.flatMap((o) => o.maps || []),
        text: [
          q.name,
          q.trader?.name,
          ...q.objectives.map((o) => o.description),
          text(q.guide),
        ].join(" "),
        hasGuide: !!q.guide?.length,
      };
    return result;
  }
  if (url === "articles/event__halloween-2026-6.json") {
    const links = `<ul>${quests.map((q) => `<li><a href="/quest/:mode/${q.normalizedName}">${escape(q.name)}</a> · ${locale === "en" ? "level" : "уровень"} ${q.minPlayerLevel}</li>`).join("")}</ul>`;
    return {
      ...base,
      html: base.html
        .replace(/<ul>[\s\S]*?<\/ul>/, links)
        .replace(
          "Все четыре задания доступны с 1-го уровня.",
          "Условия получения указаны в карточках заданий.",
        )
        .replace(
          "All four tasks require level 1.",
          "See each task for its requirements.",
        )
        .replace(
          "Справочник проверен 30 октября.",
          "Прохождения обновляются отдельно от приложения.",
        )
        .replace(
          "Guide checked on 30 October.",
          "Walkthroughs update independently from the app.",
        ),
    };
  }
  return base;
}
export function resetEventContent() {
  bundle = null;
  eventContentState = { phase: "idle", lastSuccess: null };
}
