const labels = {
  trader: "Торговцы",
  boss: "Боссы",
  quest: "Задания",
  item: "Предметы",
  hideout: "Убежище",
  event: "События",
  season: "Сезоны",
  news: "Новости",
  map: "Карты",
};
export function parentRoute(hash) {
  const [section, second, slug] = hash
    .replace(/^#?\//, "")
    .split("?")[0]
    .split("/");
  if (!labels[section] || !second) return null;
  const hasMode = ["regular", "pve"].includes(second);
  if (hasMode && !slug) return null;
  return {
    hash: `#/${section}${hasMode ? "/" + second : ""}`,
    label: labels[section],
    section,
  };
}
export function addBackButton(root) {
  const parent = parentRoute(location.hash);
  if (!parent || parent.section === "map") return;
  const row = document.createElement("div");
  row.className = "view-back";
  const button = document.createElement("button");
  button.className = "quiet";
  button.innerHTML = `← ${parent.label} <kbd>Esc</kbd>`;
  button.onclick = () => {
    location.hash = parent.hash;
  };
  row.append(button);
  root.prepend(row);
}
const installed = new WeakSet();
export function installBackNavigation(doc = document) {
  if (installed.has(doc)) return;
  installed.add(doc);
  doc.addEventListener("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    if (
      document.querySelector("dialog[open]") ||
      document.fullscreenElement ||
      event.target.closest?.('input,textarea,select,[contenteditable="true"]')
    )
      return;
    const parent = parentRoute(location.hash);
    if (parent) {
      event.preventDefault();
      location.hash = parent.hash;
    }
  });
}
