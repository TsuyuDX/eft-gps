import { isSecretThemeActive } from "../core/secret-theme.js";
import { secretBrandText } from "../core/secret-brand.js";
import { localeCode } from "../core/localization.js";
import { language, installLocalization } from "../core/localization.js";
import { installBackNavigation } from "../core/back-navigation.js";
import { db, json, asset, localHref } from "../core/data.js";
import { current, setHideout } from "../core/state.js";
import { esc, heading, img, toast } from "../core/ui.js";
import { hideoutRequirements } from "./progress.js";
import { itemRows, bindFavorites } from "./catalog.js";
import { installAppNavigation } from "../core/navigation.js";
import { installDesktopUi } from "../core/desktop-ui.js";
const listSearch = new Map();
export function renderArticleList(root, type) {
  const titles = {
    boss: "Боссы",
    trader: "Торговцы",
    event: "События",
    season: "Сезоны",
    news: "Новости",
  };
  const data = db.articles.filter(
    (x) =>
      x.type === type &&
      !(
        x.path.split("/").filter(Boolean).length === 2 &&
        ["regular", "pve"].includes(x.path.split("/")[1])
      ),
  );
  root.innerHTML =
    heading(titles[type] || "Справочник", "Справочник доступен без интернета") +
    `<div class="toolbar"><input type="search" id="article-search" aria-label="Поиск в разделе" placeholder="Поиск по названию…"><span class="muted" id="article-count" role="status"></span></div><div class="card-grid">${data
      .map((x) => {
        const slug = x.path.split("/").at(-1),
          trader = db.lookup.traders?.[slug];
        return `<a class="card article-card${type === "event" ? " event-card" : ""}" href="#/${x.path}">${img(trader?.imageLink || x.image || (type === "boss" ? `https://assets.tarkov.dev/${slug}-portrait.png` : ""), x.title)}<div class="card-body"><h2>${esc(trader?.name || x.title)}</h2><span class="muted small">Подробнее →</span></div></a>`;
      })
      .join(
        "",
      )}${type === "season" ? `<a class="card" href="#/modifiers"><div class="card-body"><h2>Калькулятор модификаторов</h2><p>Соберите сезонный билд и проверьте баланс очков.</p></div></a>` : ""}</div>`;
  const search = root.querySelector("#article-search"),
    cards = [...root.querySelectorAll(".article-card")],
    count = root.querySelector("#article-count");
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "Ничего не найдено. Попробуйте другое название.";
  empty.hidden = true;
  root.append(empty);
  search.value = listSearch.get(type) || "";
  search.oninput = () => {
    listSearch.set(type, search.value);
    const query = search.value
      .toLocaleLowerCase("ru")
      .replaceAll("ё", "е")
      .trim();
    cards.forEach((card) => {
      card.hidden = !card
        .querySelector("h2")
        .textContent.toLocaleLowerCase("ru")
        .replaceAll("ё", "е")
        .includes(query);
    });
    const visible = cards.filter((card) => !card.hidden).length;
    count.textContent = "Показано: " + visible + " из " + cards.length;
    empty.hidden = visible > 0;
  };
  search.oninput();
}
export async function renderArticle(root, path) {
  const sourcePath = path.replace("/pve/", "/regular/");
  const a = await json(
      "articles/" + sourcePath.replaceAll("/", "__") + ".json",
    ),
    type = path.split("/")[0],
    slug = path.split("/").at(-1);
  let prefix =
    type === "hideout"
      ? `<div class="row"><label>Построенный уровень <input id="station-level" type="number" min="0" max="10" value="${current().hideout[slug] || 0}"></label><a class="button" href="#/items-tracker/${db.mode}">Трекер предметов →</a></div>${hideoutRequirements(slug)}`
      : type === "season"
        ? '<a class="button primary" href="#/modifiers">Открыть калькулятор модификаторов →</a>'
        : "";
  root.innerHTML =
    heading(a.title) +
    prefix +
    `<div id="article-interactive"></div><div class="article-frame-wrap"><iframe id="article-frame" title="${esc(a.title)}" sandbox="allow-same-origin allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox"></iframe></div>`;
  const doc = new DOMParser().parseFromString(a.html, "text/html");
  doc
    .querySelectorAll(
      "script,iframe,object,embed,form,template,style,link,meta,base",
    )
    .forEach((e) => e.remove());
  doc.querySelectorAll("*").forEach((e) => {
    for (const attr of [...e.attributes])
      if (
        attr.name.startsWith("on") ||
        attr.name === "srcset" ||
        attr.name === "style"
      )
        e.removeAttribute(attr.name);
    if (e.tagName === "IMG") {
      let src = e.getAttribute("src") || "";
      if (src.startsWith("/_next/image"))
        src = new URL(src, location.origin).searchParams.get("url") || "";
      e.src = asset(src);
      e.removeAttribute("width");
      e.removeAttribute("height");
      e.loading = "lazy";
    }
    if (e.tagName === "A") {
      const h = e.getAttribute("href") || "";
      e.href = localHref(h).startsWith("#")
        ? location.origin + "/" + localHref(h)
        : localHref(h);
      e.target = localHref(h).startsWith("#") ? "_top" : "_blank";
      e.rel = "noopener";
      if (h.startsWith("#")) {
        e.href = h;
        e.target = "_self";
      }
      if (/^(javascript|data):/i.test(h)) e.removeAttribute("href");
    }
    if (["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(e.tagName))
      e.remove();
    if (e.tagName === "USE") e.remove();
  });
  for (const link of [...doc.querySelectorAll("a")]) {
    if (/tarkovhead/i.test(link.textContent)) link.remove();
  }
  for (
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    walker.nextNode();
  ) {
    walker.currentNode.textContent = walker.currentNode.textContent.replace(
      /TarkovHead/gi,
      "EFT GPS",
    );
  }
  const frame = root.querySelector("#article-frame");
  frame.srcdoc = `<!doctype html><html lang="${language()}" class="dark"><head><meta charset="UTF-8"><style>html{color-scheme:dark}*{scrollbar-width:thin;scrollbar-color:rgba(185,171,130,.34) transparent}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:rgba(185,171,130,.34);border-radius:8px}::-webkit-scrollbar-track{background:transparent}html,body{background:#000000;color:#e5e5e5;font-family:"Segoe UI",Arial,sans-serif;margin:0;padding:12px}img{max-width:100%;max-height:540px;width:auto;height:auto;object-fit:contain}a{color:#b9ab82}table{width:100%;border-collapse:collapse}td,th{padding:12px;border-bottom:1px solid #292922;text-align:left}blockquote{border-left:2px solid #b9ab82;margin:20px 0;padding:4px 18px;color:#aaa99f}h1,h2,h3{color:#ded9c9}details{padding:12px;border:1px solid #292922}button,input,select{display:none}svg:empty{display:none}p{line-height:1.8}h1,h2,h3{margin:1em 0}.container{max-width:100%}li{margin:.3em 0}</style></head><body>${doc.body.innerHTML}</body></html>`;
  frame.onload = () => {
    try {
      const frameDoc = frame.contentDocument;
      const baseStyle = frameDoc.querySelector("style").textContent;
      const originalText = new Map();
      function syncFrameTheme() {
        const secret = isSecretThemeActive();
        frameDoc.querySelector("style").textContent =
          baseStyle +
          (secret
            ? `
          html,body{background:#232e40;color:#edf3fb;font-family:Arial,"Segoe UI",sans-serif}
          a{color:#83b9ff}h1,h2,h3{color:#f3f6fc}table{background:#29364b;border-radius:16px;overflow:hidden}
          td,th{border-color:#91b3e324}th{background:#33445e}tr:nth-child(even){background:#ffffff04}
          blockquote{border-left:3px solid #6ba8ff;color:#b7c9e1;background:#2d3d56;border-radius:0 14px 14px 0;padding:14px 20px}
          details{border:1px solid #91b3e324;border-radius:16px;background:#2b3950;padding:16px}summary{cursor:pointer}
          img{border-radius:14px}*{scrollbar-color:#94b9ee55 transparent}::-webkit-scrollbar-thumb{background:#94b9ee55}
        `
            : "");
        const walker = frameDoc.createTreeWalker(
          frameDoc.body,
          NodeFilter.SHOW_TEXT,
        );
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!originalText.has(node)) originalText.set(node, node.textContent);
          node.textContent = secret
            ? secretBrandText(originalText.get(node))
            : originalText.get(node);
        }
      }
      syncFrameTheme();
      window.addEventListener("map-marker-style-changed", syncFrameTheme);
      window.addEventListener(
        "view-changing",
        () =>
          window.removeEventListener(
            "map-marker-style-changed",
            syncFrameTheme,
          ),
        { once: true },
      );

      installAppNavigation(frame.contentDocument);
      frame.contentDocument.body.dataset.selectable = "";
      installDesktopUi(frame.contentDocument);
      installBackNavigation(frame.contentDocument);
      frame.style.height =
        Math.min(
          60000,
          Math.max(600, frame.contentDocument.body.scrollHeight + 80),
        ) + "px";
      for (const im of frame.contentDocument.images)
        im.addEventListener(
          "load",
          () =>
            (frame.style.height =
              Math.min(
                60000,
                Math.max(600, frame.contentDocument.body.scrollHeight + 80),
              ) + "px"),
        );
    } catch {}
  };
  if (type === "hideout") {
    root.querySelector("#station-level").onchange = (e) => {
      setHideout(slug, e.target.value);
      toast("Уровень сохранён");
    };
    root.querySelectorAll("[data-build]").forEach(
      (b) =>
        (b.onclick = () => {
          setHideout(slug, b.dataset.build);
          renderArticle(root, path);
        }),
    );
  }
  if (type === "trader") {
    try {
      const data = await json("traders/" + slug + ".json");
      const box = root.querySelector("#article-interactive");
      box.innerHTML = `<section class="panel"><h2>Ассортимент</h2><div class="toolbar"><input id="trader-search" placeholder="Найти в ассортименте"><select id="trader-level" aria-label="Уровень торговца"><option value="0">Все уровни</option>${[1, 2, 3, 4].map((x) => `<option value="${x}">Уровень ${x}</option>`).join("")}</select></div><div id="trader-items"></div><h3>Уровни лояльности</h3><div class="stats">${(data.levels || db.lookup.traders[slug]?.levels || []).map((x) => `<div class="stat"><span>Уровень ${x.level}</span><strong>Ур. ${x.requiredPlayerLevel}</strong><small>Репутация ${x.requiredReputation}<br>Оборот ${Number(x.requiredCommerce).toLocaleString(localeCode())}</small></div>`).join("")}</div></section>`;
      const draw = () => {
        const q = box.querySelector("#trader-search").value.toLowerCase(),
          lvl = Number(box.querySelector("#trader-level").value);
        const items = data.items
          .filter(
            (x) =>
              x.name.toLowerCase().includes(q) &&
              (!lvl ||
                x.moneyOffers?.some((o) => o.vendor.minTraderLevel === lvl) ||
                x.barters?.some((o) => o.level === lvl)),
          )
          .map((x) => {
            const item = db.items.find((i) => i.id === x.id) || x;
            const offer =
              x.moneyOffers?.find(
                (o) => !lvl || o.vendor.minTraderLevel === lvl,
              ) || x.moneyOffers?.[0];
            return {
              ...item,
              trades: {
                ...item.trades,
                bestBuyVendor: offer || item.trades?.bestBuyVendor,
              },
            };
          });
        box.querySelector("#trader-items").innerHTML =
          `<div class="table-wrap"><table><thead><tr><th>★</th><th>Предмет</th><th>Барахолка</th><th>Купить у торговца, ₽</th><th>Продать торговцу, ₽</th><th>Размер</th></tr></thead><tbody>${itemRows(items)}</tbody></table></div><p class="muted small">${items.length} предметов. Ассортимент из общего снимка PvP.</p>`;
        bindFavorites(box);
      };
      box
        .querySelectorAll("input,select")
        .forEach((e) =>
          e.addEventListener(e.tagName === "INPUT" ? "input" : "change", draw),
        );
      draw();
    } catch {}
  }
}
