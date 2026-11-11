export class ViewCache {
  constructor(limit = 8) {
    this.limit = limit;
    this.views = new Map();
    this.scroll = new Map();
  }
  save(key, root, { cache = false } = {}) {
    if (!key) return;
    this.scroll.set(key, { top: root.scrollTop, left: root.scrollLeft });
    if (cache) {
      const nodes = [...root.childNodes];
      this.views.delete(key);
      this.views.set(key, nodes);
      while (this.views.size > this.limit)
        this.views.delete(this.views.keys().next().value);
    }
    while (this.scroll.size > 80)
      this.scroll.delete(this.scroll.keys().next().value);
  }
  restore(key, root) {
    const nodes = this.views.get(key);
    if (!nodes) return false;
    root.replaceChildren(...nodes);
    this.views.delete(key);
    return true;
  }
  position(key) {
    return this.scroll.get(key) || { top: 0, left: 0 };
  }
}
