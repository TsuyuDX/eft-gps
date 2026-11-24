// Base locations share imagery with their level/time variants; map geometry is unchanged.
const slugs = new Set([
  "customs",
  "factory",
  "ground-zero",
  "interchange",
  "lighthouse",
  "night-factory",
  "reserve",
  "shoreline",
  "streets-of-tarkov",
  "terminal",
  "the-lab",
  "the-labyrinth",
  "woods",
  "icebreaker",
  "ground-zero-21",
]);
export function locationPreview(slug) {
  if (!slugs.has(slug)) return null;
  return (
    "/assets/graphics-previews/" +
    ({ "night-factory": "factory", "ground-zero-21": "ground-zero" }[slug] ||
      slug) +
    ".jpg"
  );
}
