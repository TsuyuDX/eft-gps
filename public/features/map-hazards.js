import { projectPoint } from "../core/domain.js";

export function hazardOutline(marker, map) {
  if (
    !["hazards", "artillery"].includes(marker.group) ||
    !Array.isArray(marker.outline) ||
    marker.outline.length < 3
  )
    return null;
  if (
    marker.outline.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))
  )
    return null;
  return marker.outline.map((p) => projectPoint(p, map));
}

export function createHazardOverlay(svg, map) {
  let nodes = new Map(),
    showAll = true,
    highlighted = null;
  function refresh() {
    for (const [index, node] of nodes) {
      node.toggleAttribute("hidden", !showAll && index !== highlighted);
      node.classList.toggle("highlighted", index === highlighted);
    }
  }
  return {
    render(markers, { all = true, muted = () => false } = {}) {
      showAll = all;
      highlighted = null;
      nodes = new Map();
      const fragment = document.createDocumentFragment();
      markers.forEach((marker, index) => {
        const outline = hazardOutline(marker, map);
        if (!outline) return;
        const node = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "polygon",
        );
        node.setAttribute(
          "points",
          outline.map((p) => `${p.x},${p.y}`).join(" "),
        );
        node.setAttribute(
          "class",
          "hazard-zone" + (muted(marker) ? " other-floor" : ""),
        );
        node.setAttribute("data-hazard-zone", index);
        node.setAttribute("vector-effect", "non-scaling-stroke");
        const title = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "title",
        );
        title.textContent = marker.title || marker.name || "Опасная зона";
        node.append(title);
        fragment.append(node);
        nodes.set(index, node);
      });
      svg.replaceChildren(fragment);
      refresh();
    },
    highlight(index) {
      highlighted = index;
      refresh();
    },
  };
}
