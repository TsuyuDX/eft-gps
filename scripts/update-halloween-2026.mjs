import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve(import.meta.dirname, ".."),
  base = path.join(root, "public/data"),
  cache = path.join(root, "work/halloween-2026");
const read = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const write = async (p, v) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v));
};
const slugs = [
  "halloween-rumors",
  "halloween-better-defence",
  "halloween-control-check",
  "halloween-unexpected-help",
];
const guides = {
  ru: [
    [
      "Примите задание у Лыжника с 1-го уровня. В меню выбора локаций переключитесь на событийные и войдите на Заражённый Завод. Устраните 10 заражённых.",
      "Возьмите запас снаряжённых магазинов: пополнять их под натиском заражённых сложно. Следите за заражённым Тагиллой. Согласно текущему прохождению, на событийном Заводе доступны Ворота 0 и Ворота 3.",
    ],
    [
      "После «Слухов» отправляйтесь в Заражённую Лабораторию. Для входа нужна ключ-карта доступа в TerraGroup Labs. Выполните все четыре цели, включая устранение 10 заражённых и успешный выход.",
      "Для событийного выхода найдите ключи от машины либо карту коллекционера. Ключи ищите в круглой конференц-комнате зоны отдыха; карта может находиться там же или у тела ЧВК в серверной. Доступны парковка и коллектор — выбирайте выход под найденный предмет. Ориентиры показаны на иллюстрациях.",
    ],
    [
      "После «Слухов» примите задание у Терапевта. Возьмите 1 комплект медицинских инструментов: он расходуется при получении образца.",
      "В Заражённой Лаборатории либо на Заражённом Заводе найдите погибшего учёного в защитном костюме, проведите взаимодействие с телом, заберите образец крови, выживите и передайте его Терапевту. Тела могут находиться в нескольких местах; смотрите иллюстрации. При гибели образец теряется.",
    ],
    [
      "После «Контрольной проверки» возьмите задание у Лыжника и ключ от комнаты 105 общежития. На Маяке найдите партию вакцины TG-VI-26 на втором этаже здания № 3 водоочистной станции.",
      "Заберите кейс, выживите и перенесите его в комнату 105 двухэтажной общаги на Таможне. Выполните закладку. Это предмет задания: он появляется при активном задании и теряется при гибели. Здесь используется комната 105, как в цели задания; упоминание 205 в таблице источника выглядит опечаткой.",
    ],
  ],
  en: [
    [
      "Accept the level 1 task from Skier. Switch to event locations in map selection and enter Infected Factory. Eliminate 10 infected.",
      "Bring spare loaded magazines; replenishing them under pressure is difficult. Watch for Infected Tagilla. The current guide lists Gate 0 and Gate 3 as the event Factory exits.",
    ],
    [
      "After Rumors, enter The Infected Lab with a TerraGroup Labs access keycard. Complete all four objectives, including 10 infected kills and successful extraction.",
      "Find Car keys or a Collector map for the event exits. Check the circular conference room in the recreation area; the Collector map may also be on a PMC body in the server room. Choose Parking or Sewage Conduit according to the item you find. See the illustrations for reference.",
    ],
    [
      "After Rumors, accept the task from Therapist. Bring 1 Medical tools set; collecting the sample consumes it.",
      "Find a dead scientist in a protective suit in The Infected Lab or Infected Factory. Interact with the body, collect the blood sample, survive, and hand it to Therapist. There are several possible locations shown in the illustrations. Death loses the sample.",
    ],
    [
      "After Control Check, accept the task from Skier and bring a Dorm room 105 key. Find the TG-VI-26 vaccine batch on the second floor of water treatment building 3 on Lighthouse.",
      "Survive with the case and stash it in room 105 of the two-story dorm on Customs. The quest item only appears while the task is active and is lost on death. Use room 105 as specified by the objective; the source table mentioning 205 appears to be a typo.",
    ],
  ],
};
const mapsByQuest = [
  ["factory"],
  ["the-lab"],
  ["the-lab", "factory"],
  ["lighthouse", "customs"],
];
const assets = await read(path.join(base, "assets.json"));
const mediaFailures = [];
let downloaded = 0;
async function localMedia(url) {
  if (!url) return null;
  if (
    assets[url] &&
    (await fs.stat(path.join(root, "public", assets[url])).catch(() => null))
  )
    return assets[url];
  const absolute = new URL(url, "https://www.tarkovhead.com");
  if (
    !["www.tarkovhead.com", "assets.tarkov.dev"].includes(absolute.hostname) ||
    !["https:"].includes(absolute.protocol)
  )
    throw Error("Unexpected media host");
  try {
    const r = await fetch(absolute, { signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw Error("HTTP " + r.status);
    const b = Buffer.from(await r.arrayBuffer());
    const ext =
      b[0] === 137
        ? ".png"
        : b[0] === 255
          ? ".jpg"
          : b.toString("ascii", 0, 4) === "RIFF"
            ? ".webp"
            : null;
    if (!ext) throw Error("Invalid raster image");
    const local =
      "/assets/halloween-2026/" +
      crypto.createHash("sha256").update(url).digest("hex").slice(0, 20) +
      ext;
    await fs.mkdir(path.dirname(path.join(root, "public", local)), {
      recursive: true,
    });
    await fs.writeFile(path.join(root, "public", local), b);
    assets[url] = local;
    downloaded++;
    return local;
  } catch (e) {
    mediaFailures.push({ url, error: e.message });
    return null;
  }
}
const variants = {};
for (const locale of ["ru", "en"]) {
  const prefix = locale === "en" ? "en/" : "";
  const maps = await read(path.join(base, prefix + "maps.json"));
  const items = await read(path.join(base, prefix + "regular/items.json"));
  variants[locale] = [];
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i],
      file = path.join(cache, locale + "-" + slug + ".json");
    let raw = await read(file).catch(() => null);
    if (!raw) {
      const r = await fetch(
        `https://www.tarkovhead.com/api/quest/${slug}?gameMode=regular&locale=${locale}`,
        { signal: AbortSignal.timeout(25000) },
      );
      if (!r.ok) throw Error("Quest " + r.status);
      raw = await r.json();
      await write(file, raw);
    }
    const q = raw.quest;
    if (!q?.name || !q.objectives?.length)
      throw Error("Incomplete quest " + slug);
    const pictures = new Map();
    function scan(v) {
      if (!v || typeof v !== "object") return;
      if (v.fields?.blockType === "slider")
        for (const x of v.fields.slider || []) {
          if (x.image?.url)
            pictures.set(x.image.url, x.caption || x.image.alt || q.name);
        }
      for (const [k, x] of Object.entries(v)) if (k !== "doc") scan(x);
    }
    scan(q.guideCms);
    await localMedia(q.taskImageLink);
    const gallery = [];
    for (const [url, alt] of pictures) {
      const src = await localMedia(url);
      if (src) gallery.push({ type: "image", src, alt });
    }
    q.guideCms = null;
    q.guide = [
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            text:
              locale === "ru"
                ? "Данные проверены 30.10.2026. Временное событие; дата окончания пока не объявлена."
                : "Checked on 30 Oct 2026. Limited-time event; no end date has been announced.",
          },
        ],
      },
      ...guides[locale][i].map((text) => ({
        type: "paragraph",
        children: [{ type: "text", text }],
      })),
      ...gallery,
    ];
    q.events = [
      {
        normalizedName: "halloween-2026",
        name: "Halloween 2026",
        startDate: "2026-10-29",
        endDate: null,
      },
    ];
    q.isEventQuest = true;
    q.eventSlug = "halloween-2026";
    q.checkedAt = "2026-10-30";
    q.iconLink = q.taskImageLink || q.trader?.imageLink;
    q.nextQuests = (q.nextQuests || []).map((x) => ({
      name: x.name,
      normalizedName: x.normalizedName,
    }));
    for (const o of q.objectives) {
      o.maps = mapsByQuest[i]
        .map((n) => maps.find((m) => m.normalizedName === n))
        .filter(Boolean)
        .map((m) => ({ name: m.name, normalizedName: m.normalizedName }));
      o.possibleLocations = [];
    }
    if (i === 1) {
      q.objectives[3].count = 10;
      q.objectives[0].items = [
        items.find(
          (x) => x.normalizedName === "terragroup-labs-access-keycard",
        ),
      ].filter(Boolean);
    }
    if (i === 2)
      q.objectives[1].items = [
        items.find((x) => x.normalizedName === "medical-tools"),
      ].filter(Boolean);
    if (i === 3) {
      q.objectives[1].requiredKeys = [
        [items.find((x) => x.normalizedName === "dorm-room-105-key")].filter(
          Boolean,
        ),
      ];
      if (locale === "ru")
        q.objectives[1].description =
          "Заложить партию вакцины в комнате 105 двухэтажной общаги на Таможне";
    }
    for (const mode of ["regular", "pve"]) {
      const dir = path.join(
        base,
        prefix,
        mode === "pve" ? "pve/quests" : "quests",
      );
      await write(path.join(dir, slug + ".json"), { quest: q });
      const listPath = path.join(base, prefix, mode, "quests.json"),
        list = await read(listPath);
      const row = {
        name: q.name,
        normalizedName: slug,
        minPlayerLevel: q.minPlayerLevel,
        trader: q.trader.normalizedName,
        type: q.type,
        iconLink: q.iconLink,
        kappaRequired: false,
        lightkeeperRequired: false,
        isEventQuest: true,
        eventSlug: q.eventSlug,
        isPastEventQuest: false,
        isSeasonalQuest: false,
      };
      const old = list.findIndex((x) => x.normalizedName === slug);
      if (old >= 0) list[old] = row;
      else list.push(row);
      await write(listPath, list);
      const searchPath = path.join(base, prefix, mode, "quest-search.json"),
        search = await read(searchPath);
      search[slug] = {
        name: q.name,
        trader: q.trader.name,
        traderSlug: q.trader.normalizedName,
        icon: q.iconLink,
        maps: q.objectives[0].maps,
        hasGuide: true,
        text: [
          q.name,
          q.trader.name,
          ...q.objectives.map((o) => o.description),
          ...guides[locale][i],
        ].join(" "),
      };
      await write(searchPath, search);
    }
    variants[locale].push({ name: q.name, slug, icon: q.iconLink });
  }
  const eventPath = "event/halloween-2026-6";
  const title =
    locale === "ru" ? "Хэллоуин 2026: заражение" : "Halloween 2026: outbreak";
  const about =
    locale === "ru"
      ? "Событие началось 29 октября с патчем 1.3.0.0. Дата окончания не объявлена. Справочник проверен 30 октября. Заражённые версии Завода и Лаборатории выбираются в отдельной вкладке игры. На них отключена страховка, а размер группы ограничен."
      : "The event started on 29 October with patch 1.3.0.0. No end date has been announced. Guide checked on 30 October. Infected Factory and The Infected Lab use a separate map-selection tab, with insurance disabled and small groups only.";
  const html = `<h2>${title}</h2><p>${about}</p><h3>${locale === "ru" ? "Цепочка заданий" : "Quest chain"}</h3><p>${locale === "ru" ? "Слухи → Лучшая защита и Контрольная проверка → Неожиданная помощь (после Контрольной проверки). Все четыре задания доступны с 1-го уровня." : "Rumors → The Best Defense and Control Check → Unexpected Help (after Control Check). All four tasks require level 1."}</p><ul>${variants[locale].map((q) => `<li><a href="/quest/:mode/${q.slug}">${q.name}</a></li>`).join("")}</ul><h3>${locale === "ru" ? "Перед рейдом" : "Before the raid"}</h3><p>${locale === "ru" ? "Возьмите запас магазинов. Для образца крови нужны медицинские инструменты; для Лаборатории — входная ключ-карта. Для партии вакцины нужен ключ от комнаты 105. Подробные шаги, награды и изображения открываются в каждом задании." : "Bring spare magazines. Blood sampling requires Medical tools; The Lab requires its access keycard. The vaccine task requires a Dorm room 105 key. Open each task for steps, rewards and images."}</p><p>${locale === "ru" ? "Эпицентры используют изменённые версии локаций. Обычные карты приложения служат общими ориентирами: расположение событийных объектов может отличаться." : "The outbreak maps are modified locations. Standard app maps are general references; event-specific geometry and objects may differ."}</p><p><a href="https://www.escapefromtarkov.com/">Battlestate Games</a></p>`;
  await write(
    path.join(base, prefix, "articles/event__halloween-2026-6.json"),
    { title, html },
  );
  const articlePath = path.join(base, prefix, "articles.json"),
    articles = await read(articlePath);
  const entry = {
    path: eventPath,
    title,
    type: "event",
    image: variants[locale][0].icon,
  };
  const old = articles.findIndex((x) => x.path === eventPath);
  if (old >= 0) articles[old] = entry;
  else articles.unshift(entry);
  await write(articlePath, articles);
}
await write(path.join(base, "assets.json"), assets);
const indexPath = path.join(base, "en/index.json"),
  index = await read(indexPath);
for (const p of [
  "articles.json",
  "articles/event__halloween-2026-6.json",
  ...["regular", "pve"].flatMap((m) => [
    m + "/quests.json",
    m + "/quest-search.json",
  ]),
  ...slugs.flatMap((s) => [
    "quests/" + s + ".json",
    "pve/quests/" + s + ".json",
  ]),
])
  if (!index.files.includes(p)) index.files.push(p);
await write(indexPath, index);
await write(path.join(base, "halloween-2026-report.json"), {
  checkedAt: "2026-10-30",
  patch: "1.3.0.0",
  event: "halloween-2026",
  quests: slugs,
  downloaded,
  mediaFailures,
  sources: [
    "https://steamcommunity.com/app/3932890/allnews/",
    "https://www.gamespress.com/ja-JP/Escape-from-Tarkov-Celebrates-Halloween-Infected-Enemies-in-Raids-and-",
    ...slugs.map((s) => "https://www.tarkovhead.com/ru/quest/regular/" + s),
  ],
  notes: [
    "Only Halloween quest records were merged; existing progress IDs and other quests remain unchanged.",
    "No event-specific geometry was invented. CMS point coordinates are not treated as game-world coordinates.",
    "Sources currently mark all four tasks inAllModes.",
    "Room 105 follows objectives; contradictory 205 in source prose was corrected.",
  ],
});
console.log(
  JSON.stringify({
    quests: slugs.length,
    languages: 2,
    modes: 2,
    downloaded,
    mediaFailures,
  }),
);
