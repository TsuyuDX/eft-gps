import fs from "node:fs/promises";
const index = {
  version: 1,
  method:
    "Existing local quest finishRewards.traderUnlock and offerUnlock; no inferred access requirements.",
  modes: {},
};
for (const mode of ["regular", "pve"]) {
  const traders = {};
  const lookup = JSON.parse(
    await fs.readFile("public/data/lookup.json", "utf8"),
  ).traders;
  const folder = "public/data/" + (mode === "pve" ? "pve/" : "") + "quests";
  for (const name of await fs.readdir(folder)) {
    if (!name.endsWith(".json")) continue;
    const q = JSON.parse(await fs.readFile(folder + "/" + name, "utf8")).quest;
    if (!q) continue;
    if (q.type === "main")
      for (const slug of [
        "prapor",
        "therapist",
        "skier",
        "peacekeeper",
        "mechanic",
        "ragman",
        "jaeger",
      ]) {
        const stem = (lookup[slug]?.name || "")
          .toLowerCase()
          .replaceAll("ё", "е")
          .replaceAll("ь", "")
          .slice(0, 5);
        if (
          stem &&
          (q.objectives || []).some((o) =>
            (o.description || "")
              .toLowerCase()
              .replaceAll("ё", "е")
              .replaceAll("ь", "")
              .includes(stem),
          )
        ) {
          const entry = (traders[slug] ||= {
            access: [],
            assortment: [],
            story: [],
          });
          entry.story ||= [];
          if (!entry.story.includes(q.normalizedName))
            entry.story.push(q.normalizedName);
        }
      }
    for (const [field, key] of [
      ["traderUnlock", "access"],
      ["offerUnlock", "assortment"],
    ])
      for (const reward of q.finishRewards?.[field] || []) {
        const slug = reward.trader?.normalizedName || reward.normalizedName;
        if (!slug) continue;
        const entry = (traders[slug] ||= { access: [], assortment: [] });
        if (!entry[key].includes(q.normalizedName))
          entry[key].push(q.normalizedName);
      }
  }
  for (const entry of Object.values(traders)) {
    entry.access.sort();
    entry.assortment.sort();
    entry.story?.sort();
  }
  index.modes[mode] = traders;
}
await fs.writeFile(
  "public/data/trader-access.json",
  JSON.stringify(index, null, 2),
);
console.log("Built trader access index from existing local quest rewards.");
