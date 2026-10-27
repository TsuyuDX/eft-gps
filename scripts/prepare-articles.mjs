import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  data = path.join(root, "public/data"),
  source = path.join(data, "source");
const write = (file, v) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof v === "string" ? v : JSON.stringify(v));
};
function hydrate(s) {
  const { document } = parseHTML(s);
  for (let n = 0; n < 8; n++) {
    let changed = false;
    for (const hidden of [...document.querySelectorAll('div[id^="S:"]')]) {
      const template = document.getElementById("B:" + hidden.id.slice(2));
      if (!template) continue;
      let next = template.nextSibling;
      while (next) {
        if (next.nodeType === 8 && next.textContent === "/$") break;
        const after = next.nextSibling;
        next.remove();
        next = after;
      }
      template.replaceWith(...hidden.childNodes);
      hidden.remove();
      changed = true;
    }
    if (!changed) break;
  }
  return document;
}
function records(s) {
  const out = [];
  for (const m of s.matchAll(
    /self.__next_f.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g,
  ))
    try {
      for (const l of JSON.parse(m[1]).split("\n"))
        try {
          out.push(JSON.parse(l.slice(l.indexOf(":") + 1)));
        } catch {}
    } catch {}
  return out;
}
function walk(x, fn) {
  if (!x || typeof x !== "object") return;
  fn(x);
  for (const v of Object.values(x)) walk(v, fn);
}
const articles = JSON.parse(fs.readFileSync(path.join(data, "articles.json"))),
  urls = new Set(),
  assets = JSON.parse(fs.readFileSync(path.join(data, "assets.json")));
function original(u) {
  if (u.startsWith("/_next/image"))
    return new URL(u, "https://www.tarkovhead.com").searchParams.get("url");
  return u;
}
function collect(doc) {
  for (const img of doc.querySelectorAll("img")) {
    const u = original(img.getAttribute("src") || "");
    if (u && /^(https:\/\/assets\.tarkov\.dev|\/api\/media\/file\/)/.test(u))
      urls.add(u);
  }
}
const home = hydrate(fs.readFileSync(path.join(source, "home.html"), "utf8"));
const newsCards = new Map(
  [...home.querySelectorAll('main a[href*="/news/"]')].map((a) => [
    a.getAttribute("href").slice(4),
    {
      image: original(a.querySelector("img")?.getAttribute("src") || ""),
      excerpt: a.querySelector("p")?.textContent || "",
      date: a.querySelector(".text-right")?.textContent || "",
    },
  ]),
);
collect(home);
for (const a of articles) {
  const file = path.join(source, a.path.replaceAll("/", "__") + ".html");
  if (!fs.existsSync(file)) continue;
  const s = fs.readFileSync(file, "utf8"),
    doc = hydrate(s);
  const main = doc.querySelector("main");
  if (!main) continue;
  const header = main.querySelector("h1,h2");
  if (header?.textContent?.trim() && a.type !== "hideout")
    a.title = header.textContent.trim();
  Object.assign(a, newsCards.get(a.path) || {});
  const poster =
    (a.type === "event" ? main.querySelector("img") : null) ||
    main.querySelector(
      'img[src*="poster"],img[src*="portrait"],img[src*="/api/media"]',
    );
  if (!a.image && poster) a.image = original(poster.getAttribute("src"));
  if (a.type === "event") a.title = a.title.replace(/Active$/, "").trim();
  collect(main);
  write(path.join(data, "articles", a.path.replaceAll("/", "__") + ".json"), {
    ...a,
    html: main.innerHTML,
  });
  if (a.type === "trader") {
    const out = { items: [], levels: [] };
    for (const r of records(s))
      walk(r, (x) => {
        if (x.items?.[0]?.moneyOffers) out.items = x.items;
        if (x.levels?.[0]?.requiredCommerce !== undefined)
          out.levels = x.levels;
      });
    write(path.join(data, "traders", a.path.split("/").at(-1) + ".json"), out);
  }
}
write(path.join(data, "articles.json"), articles);
let i = 0;
const list = [...urls];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (;;) {
      const u = list[i++];
      if (!u) return;
      if (assets[u]) continue;
      try {
        const full = u.startsWith("/") ? "https://www.tarkovhead.com" + u : u,
          r = await fetch(full, { signal: AbortSignal.timeout(45000) });
        if (!r.ok) throw Error(r.status);
        const name =
          crypto.createHash("sha256").update(u).digest("hex").slice(0, 24) +
          (path.extname(new URL(full).pathname) || ".webp");
        fs.writeFileSync(
          path.join(root, "public/assets", name),
          Buffer.from(await r.arrayBuffer()),
        );
        assets[u] = "/assets/" + name;
      } catch (e) {
        console.log("Image unavailable", u, e.message);
      }
    }
  }),
);
write(path.join(data, "assets.json"), assets);
const font =
  assets["/_next/static/immutable/media/geist_mono_vf-s.p.0kq4e1146y5_w.woff"];
if (font) {
  const css = path.join(root, "public/style.css");
  let s = fs.readFileSync(css, "utf8").replace(/^@font-face\{[^\n]*\}\n/, "");
  write(
    css,
    `@font-face{font-family:'Tarkov Mono';src:url('${font}') format('woff');font-style:normal;font-weight:100 900;font-display:swap}\n` +
      s,
  );
}
const manifest = JSON.parse(fs.readFileSync(path.join(data, "manifest.json")));
manifest.counts.assets = Object.keys(assets).length;
write(path.join(data, "manifest.json"), manifest);
console.log(
  "Prepared",
  articles.length,
  "articles,",
  list.length,
  "article images",
);
