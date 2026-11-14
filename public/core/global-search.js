import {textPair} from "./localization.js";
import {gameInfo} from "./game-info-client.js";
import { db, json } from "./data.js";
import { language, t } from "./localization.js";
import { normalizeQuestSearch } from "./quest-search.js";
import { esc, img, modal } from "./ui.js";
const plain = (value) => String(value || "").replace(/<[^>]*>/g, " ");
export function buildSearchIndex(data, aliases = {}) {
  const entries = new Map(),
    mode = data.mode || "regular";
  function add(type, list, aliasList, route, extra = {}) {
    const alternate = new Map(
      (aliasList || []).map((x) => [
        x.routeSlug || x.normalizedName || x.path || x.slug || x.id,
        x,
      ]),
    );
    for (const value of list || []) {
      const slug =
        value.routeSlug ||
        value.normalizedName ||
        value.path ||
        value.slug ||
        value.id;
      if (!slug) continue;
      const alias = alternate.get(slug) || {},
        name = value.name || value.title || slug,
        href = route(value);
      if (entries.has(href)) continue;
      const text = normalizeQuestSearch(
        plain(
          [
            name,
            typeof name==="string"?t(name):"",
            value.shortName,
            slug,
            value.description,
            value.summary,
            value.paragraphs,
            value.text,
            alias.name,
            alias.title,
            alias.shortName,
            alias.description,
            extra[slug]?.text,
          ]
            .filter(Boolean)
            .join(" "),
        ),
      );
      entries.set(href, {
        type,
        name,
        href,
        icon: value.iconLink || value.imageLink || value.preview || value.image,
        text,
        title: normalizeQuestSearch(name),
        titles: [name, value.shortName, alias.name, alias.shortName, slug]
          .filter(Boolean)
          .map(normalizeQuestSearch),
      });
    }
  }
  add(
    "Предмет",
    data.items,
    aliases.items,
    (x) => `#/item/${mode}/${x.normalizedName}`,
  );
  add(
    "Задание",
    data.quests,
    aliases.quests,
    (x) => `#/quest/${mode}/${x.normalizedName}`,
    data.questSearch,
  );
  add(
    "Карта",
    data.maps,
    aliases.maps,
    (x) => `#/map/${mode}/${x.routeSlug || x.normalizedName}`,
  );
  add(
    "Убежище",
    Object.values(data.lookup?.hideout || {}),
    Object.values(aliases.lookup?.hideout || {}),
    (x) => `#/hideout/${mode}/${x.normalizedName}`,
  );
  add(
    "Торговец",
    Object.values(data.lookup?.traders || {}),
    Object.values(aliases.lookup?.traders || {}),
    (x) => `#/trader/${mode}/${x.normalizedName}`,
  );
  for (const type of ["boss", "trader", "event", "season", "hideout"]) {
    const label = {
      boss: "Босс",
      trader: "Торговец",
      event: "Событие",
      season: "Сезон",
      hideout: "Убежище",
    }[type];
    add(
      label,
      (data.articles || []).filter((x) => x.type === type),
      (aliases.articles || []).filter((x) => x.type === type),
      (x) => "#/" + x.path.replaceAll(":mode", mode),
    );
  }
  for (const [kind,label] of [["event","Событие"],["season","Сезон"],["promo","Промокод"]])
    add(label, (data.information || []).filter(x=>x.type===kind), [], x=>"#/intel/"+x.id);
  add(
    "Новость",
    data.news,
    [],
    (x) => "#/news/" + (x.slug || x.id || x.normalizedName),
  );
  return [...entries.values()];
}
export function searchEntries(index, query, perCategory = 8) {
  const q = normalizeQuestSearch(query),
    tokens = q.split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const identifier = /^[\p{L}\p{N}]+[-_][\p{L}\p{N}]+$/u.test(String(query).trim());
  const counts = new Map();
  return index
    .filter((x) => identifier ? x.text.includes(q) : tokens.every((token) => x.text.includes(token)))
    .map((x) => ({
      ...x,
      score: Math.min(
        ...(x.titles || [x.title]).map((title) =>
          title === q ? 0 : title.startsWith(q) ? 1 : title.includes(q) ? 2 : 3,
        ),
      ),
    }))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .filter((x) => {
      const count = counts.get(x.type) || 0;
      counts.set(x.type, count + 1);
      return count < perCategory;
    })
    .slice(0, 64);
}
let cached, signature;
export async function globalIndex(news = []) {
  const newsRevision = news.map(x=>[x.slug,x.title,x.summary].join("\n")).join("\n\n");
  const key = [db.mode, language(), db.items, db.quests, db.articles, db.maps, db.lookup, gameInfo(), newsRevision];
  if (!signature || key.some((v, i) => v !== signature[i])) {
    signature = key;
    const snapshot = { ...db };
    cached = (async () => {
      const other = language() === "en" ? "ru" : "en",
        names = ["items", "quests", "maps", "lookup", "articles"];
      const values = await Promise.all(
        names.map((name) =>
          json(
            (["items", "quests"].includes(name) ? snapshot.mode + "/" : "") +
              name +
              ".json",
            other,
          ).catch(() => []),
        ),
      );
      const questSearch = await json(
        snapshot.mode + "/quest-search.json",
      ).catch(() => ({}));
      return buildSearchIndex(
        { ...snapshot, questSearch, news, information:gameInfo().records.filter(x=>x.type!=="news").map(x=>({...x,title:x.title[language()]||x.title.en,name:x.title[language()]||x.title.en,text:[x.title.ru,x.title.en,x.code,x.description.ru,x.description.en].filter(Boolean).join(" ")})) },
        Object.fromEntries(names.map((name, i) => [name, values[i]])),
      );
    })();
  }
  return cached;
}
export function bindGlobalSearch(field, box, news = []) {
  let generation = 0;
  box.hidden = true;
  field.setAttribute("aria-controls", box.id || (box.id = "search-results"));
  field.setAttribute("aria-expanded", "false");
  const visibility = (visible) => {
    box.hidden = !visible;
    field.setAttribute("aria-expanded", String(visible));
  };
  field.setAttribute(
    "placeholder",
    textPair("Предметы, задания, карты и справочник","Search items, quests, maps and guides"),
  );
  field.oninput = async () => {
    const own = ++generation,
      query = field.value;
    visibility(Boolean(query.trim()));
    if (box.hidden) return;
    box.textContent = textPair("Поиск…","Searching…");
    try {
      const results = searchEntries(await globalIndex(news), query);
      if (own !== generation || field.value !== query || !field.isConnected) return;
      const labels = {
        Предмет: "Item",
        Задание: "Quest",
        Карта: "Map",
        Убежище: "Hideout",
        Торговец: "Trader",
        Босс: "Boss",
        Событие: "Event",
        Сезон: "Season",
        Новость: "News",
        Промокод: "Promo code",
      };
      box.innerHTML =
        results
          .map(
            (x) =>
              `<a href="${esc(x.href)}">${img(x.icon, "")}<span>${esc(x.name)}</span><small class="muted">${esc(language() === "en" ? labels[x.type] : x.type)}</small></a>`,
          )
          .join("") ||
        (textPair("Ничего не найдено. Попробуйте другие ключевые слова.","Nothing found. Try different keywords."));
    } catch {
      if (own === generation)
        box.textContent =
          textPair("Поиск недоступен. Попробуйте ещё раз.","Search is unavailable. Try again.");
    }
  };
  field.onkeydown = (e) => {
    if (e.key === "Escape") {
      generation++;
      visibility(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      box.querySelector("a")?.click();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      box.querySelector("a")?.focus();
    }
  };
  box.onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      generation++;
      visibility(false);
      field.focus();
      return;
    }
    const links = [...box.querySelectorAll("a")],
      i = links.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      links[
        Math.max(
          0,
          Math.min(links.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)),
        )
      ]?.focus();
    }
  };
}
export function openGlobalSearch(news = []) {
  modal(
    "<h2>" +
      (textPair("Поиск по приложению","Search the application")) +
      '</h2><input id="app-search-field" type="search" autocomplete="off" style="width:100%"><div class="global-results" id="app-search-results"></div>',
  );
  const field = document.querySelector("#app-search-field");
  bindGlobalSearch(field, document.querySelector("#app-search-results"), news);
  field.focus();
}
