import { asset, localHref } from "./data.js";
export const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (n) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽"
    : "—";
export const img = (u, alt = "", cls = "") =>
  `<img class="${cls}" src="${asset(u)}" alt="${esc(alt)}" loading="lazy">`;
export const heading = (title, sub = "", actions = "") =>
  `<div class="page-title"><div><div class="eyebrow">TARKOVHEAD / ЛОКАЛЬНЫЙ СПРАВОЧНИК</div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${esc(sub)}</p>` : ""}</div><div class="row">${actions}</div></div>`;
export function toast(message) {
  const e = document.querySelector("#toast");
  e.textContent = message;
  e.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => e.classList.remove("show"), 3000);
}
export function modal(content) {
  document.querySelector("#modal-content").innerHTML = content;
  document.querySelector("#modal").showModal();
}
export function errorView(e) {
  return `<div class="empty"><h2>Данные недоступны</h2><p>${esc(e.message)}</p><a class="button" href="#/settings">Проверить базу</a></div>`;
}
export function rich(x) {
  if (!x) return "";
  if (typeof x === "string") return esc(x).replaceAll("\\n", "<br>");
  if (Array.isArray(x)) return x.map(rich).join("");
  const inner = rich(x.content || x.children || x.text || "");
  switch (x.type) {
    case "text":
      return inner;
    case "link":
      return (
        '<a href="' +
        esc(localHref(x.href)) +
        '">' +
        (inner || esc(x.title)) +
        "</a>"
      );
    case "mapPointLink":
      return (
        '<a class="button" href="' +
        esc(localHref(x.href)) +
        '">⌖ ' +
        esc(x.description || x.mapName) +
        "</a>"
      );
    case "image":
      return (
        '<a href="' +
        asset(x.previewSrc || x.src) +
        '" target="_blank">' +
        img(x.src || x.url || x.image?.url, x.alt, "guide-image") +
        "</a>"
      );
    case "heading":
      return "<h3>" + inner + "</h3>";
    case "list":
      return (
        "<ul>" +
        ((x.items || []).map((v) => "<li>" + rich(v) + "</li>").join("") ||
          inner) +
        "</ul>"
      );
    case "listItem":
      return "<li>" + inner + "</li>";
    case "paragraph":
      return "<p>" + inner + "</p>";
    case "table":
      return (
        '<div class="table-wrap"><table>' + rich(x.rows) + "</table></div>"
      );
    case "tableRow":
      return "<tr>" + rich(x.cells) + "</tr>";
    case "tableCell": {
      const tag = x.isHeader ? "th" : "td";
      return (
        "<" +
        tag +
        ' colspan="' +
        (Number(x.colSpan) || 1) +
        '">' +
        inner +
        "</" +
        tag +
        ">"
      );
    }
    default:
      return inner;
  }
}
export function pagination(total, page, size) {
  const count = Math.max(1, Math.ceil(total / size));
  return `<div class="pagination"><span class="muted">${total.toLocaleString("ru-RU")} результатов · ${page + 1} / ${count}</span><div class="row"><button data-page="${page - 1}" ${page === 0 ? "disabled" : ""}>← Назад</button><button data-page="${page + 1}" ${page >= count - 1 ? "disabled" : ""}>Далее →</button></div></div>`;
}
export function bindPages(root, fn) {
  root
    .querySelectorAll("[data-page]")
    .forEach((b) => (b.onclick = () => fn(Number(b.dataset.page))));
}
