import { uiIcon } from "../core/icons.js";
import { asset, localHref } from "../core/data.js";
import { esc } from "../core/ui.js";
export const guideAvailable = (q) =>
  !!q.guide?.length || !!q.guideCms?.root?.children?.length;
function safeHref(href) {
  const value = localHref(String(href || ""));
  return /^(#|https?:\/\/|\/assets\/)/i.test(value) ? value : "";
}
export function guideImage(image, caption = "", inline = false) {
  const src = image.src || image.url || image.image?.url;
  const local = asset(src),
    preview = asset(image.previewSrc || src);
  const title = caption || image.alt || "Иллюстрация прохождения";
  if (local === "/assets/fallback.svg")
    return `<span class="quest-image-missing">${esc(title)} · изображение недоступно у источника</span>`;
  return `<button class="quest-guide-image${inline ? " inline-image" : ""}" type="button" data-quest-image="${esc(preview === "/assets/fallback.svg" ? local : preview)}" data-caption="${esc(title)}"><img src="${esc(local)}" alt="${esc(title)}" loading="lazy"><span>${esc(title)}</span></button>`;
}
function cmsLink(fields) {
  const doc = fields?.doc,
    value = doc?.value;
  if (doc?.relationTo === "mapPoints" && value?.map?.normalizedName)
    return `/map/:mode/${value.map.normalizedName}?q=${encodeURIComponent(value.routeSlug || value.id)}`;
  if (value?.normalizedName) {
    const type = {
      quests: "quest",
      items: "item",
      maps: "map",
      traders: "trader",
    }[doc?.relationTo];
    if (type) return `/${type}/:mode/${value.normalizedName}`;
  }
  return fields?.url || "";
}
export function renderGuide(value, { inline = false } = {}) {
  if (!value) return "";
  if (typeof value === "string") return esc(value).replace(/\r?\n/g, "<br>");
  if (Array.isArray(value))
    return value
      .map((v, index) => {
        const content = renderGuide(v, { inline });
        const title =
          v?.type === "table"
            ? v.rows?.[0]?.cells?.[0]?.content?.[0]?.content
            : "";
        return index === 0 && /Связанные квестовые предметы/.test(title || "")
          ? `<details class="quest-guide-reference"><summary>Нужные ключи и квестовые предметы</summary>${content}</details>`
          : content;
      })
      .join("");
  if (value.root) return renderGuide(value.root, { inline });
  const inner = renderGuide(value.content ?? value.children ?? value.text, {
    inline,
  });
  switch (value.type) {
    case "root":
      return inner;
    case "text": {
      let html = inner;
      if (typeof value.format === "number") {
        if (value.format & 1) html = `<strong>${html}</strong>`;
        if (value.format & 2) html = `<em>${html}</em>`;
        if (value.format & 4) html = `<s>${html}</s>`;
        if (value.format & 16) html = `<code>${html}</code>`;
      }
      return html;
    }
    case "linebreak":
      return "<br>";
    case "paragraph":
      return `<p>${inner}</p>`;
    case "heading": {
      const tag = /^h[2-6]$/.test(value.tag)
        ? value.tag
        : "h" + Math.max(2, Math.min(6, Number(value.level) || 3));
      return `<${tag}>${inner}</${tag}>`;
    }
    case "link":
    case "autolink": {
      const href = safeHref(value.href || value.url || cmsLink(value.fields));
      return href
        ? `<a href="${esc(href)}" ${/^https?:/i.test(href) ? 'target="_blank" rel="noopener"' : ""}>${inner || esc(value.title || value.fields?.doc?.label || "Открыть")}</a>`
        : inner;
    }
    case "mapPointLink":
      return `<a class="button quest-map-link" href="${esc(safeHref(value.href))}">⌖ ${esc(value.description || value.mapName || "Показать на карте")}</a>`;
    case "image":
      return guideImage(value, "", inline);
    case "list": {
      if (value.variant === "gallery")
        return `<div class="quest-gallery">${(value.items || []).map((item) => `<figure>${renderGuide(item)}</figure>`).join("")}</div>`;
      const tag =
        value.ordered || value.tag === "ol" || value.listType === "number"
          ? "ol"
          : "ul";
      return `<${tag}>${value.items ? value.items.map((item) => `<li>${renderGuide(item, { inline })}</li>`).join("") : inner}</${tag}>`;
    }
    case "listItem":
    case "listitem":
      return `<li>${inner}</li>`;
    case "table":
      return `<div class="table-wrap quest-guide-table"><table>${renderGuide(value.rows || value.children, { inline: true })}</table></div>`;
    case "tableRow":
    case "tablerow":
      return `<tr>${renderGuide(value.cells || value.children, { inline: true })}</tr>`;
    case "tableCell":
    case "tablecell": {
      const tag = value.isHeader || value.headerState ? "th" : "td";
      return `<${tag} colspan="${Math.max(1, Math.min(100, Number(value.colSpan) || 1))}">${renderGuide(value.content || value.children, { inline: true })}</${tag}>`;
    }
    case "block":
    case "inlineBlock": {
      const fields = value.fields || {};
      if (fields.blockType === "slider")
        return `<div class="quest-gallery">${(fields.slider || []).map((item) => `<figure>${guideImage(item.image || {}, item.caption)}</figure>`).join("")}</div>`;
      if (fields.blockType === "wikiInlineImage")
        return guideImage(fields, "", true);
      if (fields.blockType === "mapPointsLink")
        return `<div class="row wrap">${(fields.points || []).map((p) => `<a class="button quest-map-link" href="${esc(localHref(`/map/:mode/${p.map?.normalizedName || fields.map?.normalizedName}?q=${encodeURIComponent(p.routeSlug || p.id)}`))}">⌖ ${esc(p.title || "Точка на карте")}</a>`).join("")}</div>`;
      return renderGuide(fields.content || fields.children);
    }
    default:
      return inner;
  }
}
export function questImages(q) {
  const images = new Map();
  if (q.taskImageLink)
    images.set(q.taskImageLink, { src: q.taskImageLink, alt: q.name });
  function walk(v) {
    if (!v || typeof v !== "object") return;
    if (v.type === "image" || (v.src && v.previewSrc)) {
      const key = v.previewSrc || v.src;
      images.set(key, { ...v });
    }
    if (v.fields?.blockType === "slider")
      for (const item of v.fields.slider || []) {
        const image = item.image;
        if (image?.url)
          images.set(image.url, {
            src: image.url,
            alt: item.caption || image.alt,
          });
      }
    for (const [key, child] of Object.entries(v))
      if (typeof child === "object" && !["doc", "quest", "map"].includes(key))
        walk(child);
  }
  walk(q.guide);
  walk(q.guideCms);
  walk(q.images);
  return [...images.values()];
}
export function bindGuideImages(root) {
  root.querySelectorAll("[data-quest-image]").forEach(
    (button) =>
      (button.onclick = () => {
        let viewer = document.querySelector("#quest-image-viewer");
        if (!viewer) {
          viewer = document.createElement("dialog");
          viewer.id = "quest-image-viewer";
          document.body.append(viewer);
          viewer.addEventListener("click", (event) => {
            if (event.target === viewer) viewer.close();
          });
        }
        viewer.innerHTML = `<div class="modal-chrome"><span>${esc(button.dataset.caption)}</span><button class="close" aria-label="Закрыть изображение">${uiIcon("close", 22)}</button></div><div class="image-viewer-body"><img src="${esc(button.dataset.questImage)}" alt="${esc(button.dataset.caption)}"></div>`;
        viewer.querySelector("button").onclick = () => viewer.close();
        viewer.showModal();
      }),
  );
}
