import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  data = path.join(root, "public/data"),
  source = path.join(data, "source"),
  articles = JSON.parse(fs.readFileSync(path.join(data, "articles.json")));
for (const type of ["news", "event", "season"]) {
  const r = await fetch("https://www.tarkovhead.com/ru/" + type),
    s = await r.text();
  const paths = [
    ...new Set(
      [...s.matchAll(new RegExp('href="(/ru/' + type + '/[^"?#]+)"', "g"))].map(
        (x) => x[1],
      ),
    ),
  ];
  for (const p of paths) {
    const key = p.slice(4);
    if (articles.some((x) => x.path === key)) continue;
    const res = await fetch("https://www.tarkovhead.com" + p);
    if (!res.ok) throw Error("Article unavailable: " + p);
    const html = await res.text();
    fs.writeFileSync(
      path.join(source, key.replaceAll("/", "__") + ".html"),
      html,
    );
    articles.push({
      path: key,
      type,
      title: (html.match(/<title>(.*?)<\/title>/)?.[1] || key).replace(
        " — TarkovHead",
        "",
      ),
    });
  }
}
fs.writeFileSync(path.join(data, "articles.json"), JSON.stringify(articles));
console.log("Article archive", articles.length);
