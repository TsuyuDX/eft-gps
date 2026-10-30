// Group close points without moving their actual map coordinates.
export function clusterMarkers(entries, width, height, distance = 36) {
  const cells = new Map(),
    groups = [];
  for (const entry of entries) {
    const x = (entry.p.x * width) / 100,
      y = (entry.p.y * height) / 100,
      cx = Math.floor(x / distance),
      cy = Math.floor(y / distance);
    // Keep named destinations and danger markers directly reachable even at low zoom.
    if (
      ["extracts", "transits", "hazards", "artillery"].includes(entry.x?.group)
    ) {
      groups.push({ x, y, p: entry.p, entries: [entry] });
      continue;
    }
    let found;
    for (let dx = -1; dx <= 1 && !found; dx++)
      for (let dy = -1; dy <= 1 && !found; dy++)
        for (const group of cells.get(cx + dx + "," + (cy + dy)) || [])
          if (Math.hypot(group.x - x, group.y - y) < distance) {
            found = group;
            break;
          }
    if (found) found.entries.push(entry);
    else {
      const group = { x, y, p: entry.p, entries: [entry] };
      groups.push(group);
      const key = cx + "," + cy;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(group);
    }
  }
  return groups;
}
