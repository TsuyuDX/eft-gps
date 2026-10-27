// Only visible native-resolution tiles enter the DOM; zoom never scales a cached bitmap.
export function createMapDetail(container, viewport, canvas, sources) {
  let source = null;
  const images = new Map();
  function clear() {
    for (const image of images.values()) image.remove();
    images.clear();
  }
  function update() {
    if (!source) return;
    const rect = canvas.getBoundingClientRect(),
      view = viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { size, minX, minY, width, height, tiles } = source;
    const left =
      minX + Math.max(0, (view.left - rect.left) / rect.width) * width;
    const right =
      minX + Math.min(1, (view.right - rect.left) / rect.width) * width;
    const top =
      minY + Math.max(0, (view.top - rect.top) / rect.height) * height;
    const bottom =
      minY + Math.min(1, (view.bottom - rect.top) / rect.height) * height;
    const visible = new Set();
    for (
      let x = Math.floor(left / size) - 1;
      x <= Math.floor(right / size) + 1;
      x++
    )
      for (
        let y = Math.floor(top / size) - 1;
        y <= Math.floor(bottom / size) + 1;
        y++
      ) {
        const key = `${x},${y}`,
          url = tiles[key];
        if (!url) continue;
        visible.add(key);
        if (images.has(key)) continue;
        const image = document.createElement("img");
        image.alt = "";
        image.draggable = false;
        image.decoding = "async";
        image.style.cssText = `left:${(100 * (x * size - minX)) / width}%;top:${(100 * (y * size - minY)) / height}%;width:calc(${(100 * size) / width}% + 0.5px);height:calc(${(100 * size) / height}% + 0.5px)`;
        image.src = url;
        container.append(image);
        images.set(key, image);
      }
    for (const [key, image] of images)
      if (!visible.has(key)) {
        image.remove();
        images.delete(key);
      }
  }
  return {
    setSource(layer) {
      const next = layer && sources[layer.tilePath];
      const available = next && Object.keys(next.tiles).length > 0;
      if (source !== (available ? next : null)) {
        clear();
        source = available ? next : null;
      }
      container.hidden = !source;
      update();
      return !!source;
    },
    update,
  };
}
