export function projectPoint(position, map) {
  const bounds = map.svgBounds || map.bounds;
  if (!bounds || !position) return { x: 50, y: 50 };
  const rad = ((map.coordinateRotation || 0) * Math.PI) / 180,
    c = Math.cos(rad),
    s = Math.sin(rad);
  const p = (x, z) => ({ x: x * c - z * s, y: -(x * s + z * c) });
  const corners = [
    p(bounds[0][0], bounds[0][1]),
    p(bounds[0][0], bounds[1][1]),
    p(bounds[1][0], bounds[0][1]),
    p(bounds[1][0], bounds[1][1]),
  ];
  const xs = corners.map((p) => p.x),
    ys = corners.map((p) => p.y),
    minX = Math.min(...xs),
    minY = Math.min(...ys);
  const v = p(position.x, position.z);
  return {
    x: (100 * (v.x - minX)) / (Math.max(...xs) - minX || 1),
    y: (100 * (v.y - minY)) / (Math.max(...ys) - minY || 1),
  };
}
export function requirements(entry, progress, scope = "all") {
  let count = 0,
    fir = false,
    reasons = [];
  if (scope !== "hideout")
    for (const [id, v] of Object.entries(entry.questsExtraData || {})) {
      const info = entry.questsData?.[id];
      if (progress.quests[info?.normalizedName || id]) continue;
      count += v.totalCount || 0;
      fir ||= !!v.foundInRaid;
      reasons.push({ kind: "quest", id, info, count: v.totalCount || 0 });
    }
  if (scope !== "quests")
    for (const [id, v] of Object.entries(entry.hideoutExtraData || {})) {
      const info = entry.hideoutData?.[id];
      if ((progress.hideout[info?.normalizedName] || 0) >= (info?.level || 1))
        continue;
      count += v.totalCount || 0;
      fir ||= !!v.foundInRaid;
      reasons.push({ kind: "hideout", id, info, count: v.totalCount || 0 });
    }
  return { count, fir, reasons };
}
export function modifierResult(modifiers, selected, base = 0) {
  const list = modifiers.filter((x) => selected.includes(x.id));
  const points = base + list.reduce((n, x) => n + x.points, 0);
  const conflicts = [];
  for (const x of list)
    for (const id of [...(x.conflicts || []), ...(x.locks || [])])
      if (selected.includes(id)) conflicts.push([x.id, id]);
  return { points, conflicts, valid: points >= 0 && !conflicts.length };
}
