import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
export const EVENT_CHECK_INTERVAL = 15 * 60 * 1000;
const ORIGIN = "https://www.tarkovhead.com";
const slugOK = (s) =>
  typeof s === "string" && /^halloween-[a-z0-9-]{1,90}$/.test(s);
const clean = (v, n = 5000) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v, max = 1e7) =>
  Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0;
const token = (v) =>
  typeof v === "string" &&
  /^[a-zA-Z0-9_-]{1,120}$/.test(v) &&
  !["__proto__", "constructor", "prototype"].includes(v)
    ? v
    : "";
const ref = (v) =>
  v && typeof v === "object"
    ? {
        id: token(v.id),
        name: clean(v.name, 300),
        normalizedName: clean(v.normalizedName || v.slug, 100),
        iconLink: clean(v.iconLink, 1000),
        imageLink: clean(v.imageLink, 1000),
      }
    : null;
export function allowedEventMedia(value) {
  try {
    const u = new URL(value, ORIGIN);
    if (u.protocol !== "https:" || u.username || u.password || u.port)
      return false;
    if (u.hostname === "assets.tarkov.dev")
      return (
        /^\/[a-zA-Z0-9._-]+\.(webp|png|jpg)$/.test(u.pathname) && !u.search
      );
    if (
      u.hostname === "www.tarkovhead.com" &&
      u.pathname === "/api/wiki/image" &&
      [...u.searchParams.keys()].join() === "url"
    ) {
      const image = new URL(u.searchParams.get("url"));
      return (
        image.protocol === "https:" &&
        !image.username &&
        !image.password &&
        !image.port &&
        image.hostname === "static.wikia.nocookie.net" &&
        /^\/escapefromtarkov_gamepedia\/images\/[a-f0-9]\/[a-f0-9]{2}\/[a-zA-Z0-9_().+-]+\.(png|jpg|webp)(?:\/revision\/latest(?:\/scale-to-width-down\/[0-9]{1,4})?)?$/.test(
          image.pathname,
        ) &&
        (!image.search || /^\?cb=[0-9]+$/.test(image.search))
      );
    }
    return (
      u.hostname === "www.tarkovhead.com" &&
      /^\/api\/media\/file\/[a-zA-Z0-9_%().+ -]+$/.test(u.pathname) &&
      !decodeURIComponent(u.pathname).includes("..") &&
      (!u.search || /^\?preset=(original|sm|md|lg)$/.test(u.search))
    );
  } catch {
    return false;
  }
}
export function sanitizeEventQuest(raw, expected) {
  const q = raw?.quest;
  if (
    !q ||
    q.normalizedName !== expected ||
    !slugOK(expected) ||
    !q.name ||
    !Array.isArray(q.objectives) ||
    q.objectives.length < 1 ||
    q.objectives.length > 80 ||
    !q.events?.some(
      (e) =>
        e.normalizedName === "halloween-2026" ||
        e.routeSlug === "halloween-2026-6",
    )
  )
    throw Error("invalid-event-quest");
  const guideText = (value) => {
    let result = clean(value);
    // Keep the documented room-105 erratum from returning through a live sync.
    if (
      expected === "halloween-unexpected-help" &&
      q.objectives.some((o) => /105/.test(o.description || ""))
    )
      result = result.replace(
        /(комнату\s+|room\s+)205/gi,
        (_, prefix) => prefix + "105",
      );
    return result;
  };
  let visited = 0;
  function nodes(v, depth = 0) {
    if (depth > 24 || ++visited > 8000) throw Error("guide-too-large");
    if (typeof v === "string") return { type: "text", text: clean(v) };
    if (Array.isArray(v))
      return v.flatMap((x) => {
        const n = nodes(x, depth + 1);
        return Array.isArray(n) ? n : n ? [n] : [];
      });
    if (!v || typeof v !== "object") return null;
    if (v.root) return nodes(v.root, depth + 1);
    if (v.type === "inlineBlock" && v.fields?.blockType === "wikiInlineImage") {
      const src = v.fields.image?.url || v.fields.src;
      return allowedEventMedia(src)
        ? { type: "image", src, alt: clean(v.fields.alt, 500), isIcon: true }
        : null;
    }
    if (v.type === "block") {
      if (v.fields?.blockType === "slider")
        return (v.fields.slider || [])
          .slice(0, 30)
          .map((x) => ({
            type: "image",
            src: clean(x.image?.url || x.src, 1000),
            alt: clean(x.caption || x.image?.alt, 500),
          }))
          .filter((x) => allowedEventMedia(x.src));
      return nodes(v.fields?.content || v.children || [], depth + 1);
    }
    if (v.type === "image")
      return allowedEventMedia(v.src || v.image?.url)
        ? { type: "image", src: v.src || v.image.url, alt: clean(v.alt, 500) }
        : null;
    const children = nodes(v.children ?? v.content ?? v.text ?? [], depth + 1);
    if (v.type === "text")
      return {
        type: "text",
        text: guideText(v.text || v.content),
        format: num(v.format, 31),
      };
    if (["link", "autolink"].includes(v.type)) {
      const doc = v.fields?.doc,
        value = doc?.value,
        slug = value?.normalizedName || value?.slug;
      const type = {
        items: "item",
        quests: "quest",
        maps: "map",
        traders: "trader",
      }[doc?.relationTo];
      const href =
        type && /^[a-z0-9-]{1,100}$/.test(slug)
          ? `#/${type}/:mode/${slug}`
          : "";
      return href ? { type: "link", href, children } : children;
    }
    const type = {
      root: "root",
      paragraph: "paragraph",
      heading: "heading",
      list: "list",
      listitem: "listitem",
      listItem: "listitem",
      table: "table",
      tablerow: "tablerow",
      tableRow: "tablerow",
      tablecell: "tablecell",
      tableCell: "tablecell",
      linebreak: "linebreak",
    }[v.type];
    if (!type) return children;
    const out = { type, children };
    if (type === "heading") out.tag = /^h[2-6]$/.test(v.tag) ? v.tag : "h3";
    if (type === "list") {
      out.ordered =
        v.tag === "ol" || v.listType === "number" || v.ordered === true;
      if (v.items) out.items = nodes(v.items, depth + 1);
    }
    if (type === "table" && v.rows) out.rows = nodes(v.rows, depth + 1);
    if (type === "tablerow" && v.cells) out.cells = nodes(v.cells, depth + 1);
    if (type === "tablecell") {
      out.colSpan = Math.max(1, num(v.colSpan, 12));
      out.isHeader = !!v.headerState;
    }
    return out;
  }
  const questRefs = (v) =>
    (Array.isArray(v) ? v : [])
      .slice(0, 50)
      .map((x) => ref(x.task || x))
      .filter((x) => x && slugOK(x.normalizedName));
  const rewards = (v) =>
    v
      ? {
          money: (v.money || []).slice(0, 12).map((x) => clean(x, 200)),
          items: (v.items || [])
            .slice(0, 50)
            .map((x) => ({ count: num(x.count, 1e8), item: ref(x.item || x) }))
            .filter((x) => x.item),
          traderStanding: (v.traderStanding || []).slice(0, 12).map((x) => ({
            trader: ref(x.trader),
            standing: Number.isFinite(x.standing)
              ? Math.max(-10, Math.min(10, x.standing))
              : 0,
          })),
        }
      : null;
  return {
    id: token(q.id),
    name: clean(q.name, 300),
    normalizedName: expected,
    type: "side",
    isEventQuest: true,
    eventSlug: "halloween-2026",
    inAllModes: q.inAllModes === true,
    minPlayerLevel: num(q.minPlayerLevel, 100),
    experience: num(q.experience),
    kappaRequired: false,
    lightkeeperRequired: false,
    iconLink: clean(q.iconLink || q.taskImageLink || q.trader?.imageLink, 1000),
    taskImageLink: clean(q.taskImageLink, 1000),
    trader: ref(q.trader),
    taskRequirements: questRefs(q.taskRequirements).map((task) => ({ task })),
    nextQuests: questRefs(q.nextQuests),
    traderRequirements: [],
    otherRequirements: [],
    objectives: q.objectives.map((o, i) => ({
      id: token(o.id) || expected + "-" + i,
      description: clean(o.description),
      count: num(o.count, 1e6),
      optional: o.optional === true,
      foundInRaid: o.foundInRaid === true,
      maps: [...(o.maps || []), ...(o.zones || []).map((z) => z.map)]
        .slice(0, 20)
        .map(ref)
        .filter(Boolean),
      items: (o.items || []).slice(0, 20).map(ref).filter(Boolean),
      requiredKeys: [],
      possibleLocations: [],
      zones: [],
    })),
    finishRewards: rewards(q.finishRewards),
    startRewards: rewards(q.startRewards),
    restartable: q.restartable === true,
    guide: nodes(
      q.guideCms?.root?.children?.length
        ? q.guideCms.root.children
        : q.guide || [],
    ),
    guideCms: null,
    events: [
      {
        normalizedName: "halloween-2026",
        name: "Halloween 2026",
        startDate: "2026-10-29",
        endDate:
          clean(
            q.events.find((e) => e.normalizedName === "halloween-2026")
              ?.endDate,
            40,
          ) || null,
      },
    ],
    liveSource: `${ORIGIN}/ru/quest/regular/${expected}`,
  };
}
export class EventContentService {
  constructor(
    root,
    { fetch: fetcher = globalThis.fetch, now = Date.now } = {},
  ) {
    this.root = path.resolve(root);
    this.directory = path.join(this.root, "userdata", "event-content");
    this.fetcher = fetcher;
    this.now = now;
    this.bundle = null;
    this.inflight = null;
    this.lastAttempt = 0;
    this.state = { phase: "idle", checkedAt: null, lastSuccess: null };
    this.ready = this.load();
  }
  async safeDirectory() {
    for (const name of [
      "userdata",
      "userdata/event-content",
      "userdata/event-content/assets",
    ]) {
      const p = path.join(this.root, name);
      try {
        await fs.mkdir(p);
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
      const s = await fs.lstat(p);
      if (!s.isDirectory() || s.isSymbolicLink())
        throw Error("unsafe-cache-directory");
    }
  }
  async load() {
    try {
      await this.safeDirectory();
      const p = path.join(this.directory, "bundle.json"),
        s = await fs.lstat(p);
      if (s.isSymbolicLink() || s.size > 12 * 1024 ** 2)
        throw Error("invalid-cache");
      const b = JSON.parse(await fs.readFile(p, "utf8"));
      if (
        b.format !== 1 ||
        !b.quests?.ru ||
        !b.quests?.en ||
        !/^[a-f0-9]{64}$/.test(b.revision)
      )
        throw Error("invalid-cache");
      for (const locale of ["ru", "en"])
        for (const [slug, q] of Object.entries(b.quests[locale]))
          if (!slugOK(slug) || q.normalizedName !== slug)
            throw Error("invalid-cache");
      this.bundle = b;
      this.state.lastSuccess = b.checkedAt;
      this.state.phase = "cached";
    } catch (e) {
      if (e.code !== "ENOENT") this.state.phase = "cached-unavailable";
    }
  }
  async response(url, limit) {
    const remaining = this.deadline ? this.deadline - Date.now() : 10000;
    if (remaining <= 0) throw Error("check-time-budget");
    const r = await this.fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(10000, remaining)),
      headers: {
        Accept: "application/json,image/webp,image/png,image/jpeg",
        "User-Agent": "EFT-GPS-event-guide/1.0",
      },
    });
    if (!r.ok || Number(r.headers.get("content-length") || 0) > limit)
      throw Error("source-unavailable");
    let length = 0;
    const parts = [];
    for await (const part of r.body) {
      length += part.length;
      if (length > limit) throw Error("source-too-large");
      parts.push(part);
    }
    return Buffer.concat(parts);
  }
  check({ force = false } = {}) {
    if (this.inflight) return this.inflight;
    this.inflight = this.run(force).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }
  async run(force) {
    await this.ready;
    const now = this.now();
    if (
      this.lastAttempt &&
      now - this.lastAttempt < (force ? 60000 : EVENT_CHECK_INTERVAL)
    )
      return this.payload();
    this.lastAttempt = now;
    this.deadline = Date.now() + 90000;
    this.state = {
      ...this.state,
      phase: "checking",
      checkedAt: new Date(now).toISOString(),
    };
    try {
      await this.safeDirectory();
      const list = JSON.parse(
        await this.response(
          ORIGIN + "/api/quest/list?gameMode=regular&locale=ru",
          1024 ** 2,
        ),
      );
      const slugs = [
        ...new Set(
          (list.quests || []).map((q) => q.normalizedName).filter(slugOK),
        ),
      ];
      if (!slugs.length || slugs.length > 24) throw Error("invalid-event-list");
      const bundled = await fs
        .readFile(path.join(this.root, "public/data/assets.json"), "utf8")
        .then(JSON.parse)
        .catch(() => ({}));
      let downloaded = 0,
        bytes = 0;
      const media = new Map();
      const cachedMedia = this.bundle?.media || {};
      const localize = async (url) => {
        if (!url) return "";
        if (!allowedEventMedia(url)) return "";
        const known = bundled[url];
        if (
          typeof known === "string" &&
          /^\/assets\/[a-zA-Z0-9_./%()+@-]+$/.test(known) &&
          !known.split("/").includes("..")
        )
          return known;
        if (media.has(url)) return media.get(url);
        const prior = cachedMedia[url];
        if (
          typeof prior === "string" &&
          /^\/assets\/live-event\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(prior)
        ) {
          const stat = await fs
            .lstat(path.join(this.directory, "assets", path.basename(prior)))
            .catch(() => null);
          if (
            stat?.isFile() &&
            !stat.isSymbolicLink() &&
            stat.size <= 4 * 1024 ** 2
          ) {
            media.set(url, prior);
            return prior;
          }
        }
        const b = await this.response(new URL(url, ORIGIN).href, 4 * 1024 ** 2);
        bytes += b.length;
        if (++downloaded > 80 || bytes > 40 * 1024 ** 2)
          throw Error("media-budget-exceeded");
        const ext = b
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "png"
          : b[0] === 255 && b[1] === 216
            ? "jpg"
            : b.toString("ascii", 0, 4) === "RIFF" &&
                b.toString("ascii", 8, 12) === "WEBP"
              ? "webp"
              : null;
        if (!ext) throw Error("invalid-image");
        const name =
            crypto.createHash("sha256").update(b).digest("hex") + "." + ext,
          p = path.join(this.directory, "assets", name);
        const old = await fs.lstat(p).catch(() => null);
        if (old?.isSymbolicLink()) throw Error("unsafe-cache-file");
        if (!old) await fs.writeFile(p, b, { flag: "wx" });
        const local = "/assets/live-event/" + name;
        media.set(url, local);
        return local;
      };
      async function localizeObject(v) {
        if (!v || typeof v !== "object") return;
        for (const [key, x] of Object.entries(v)) {
          if (
            ["src", "iconLink", "imageLink", "taskImageLink"].includes(key) &&
            typeof x === "string"
          )
            try {
              v[key] = await localize(x);
            } catch (error) {
              if (v.isIcon) {
                media.set(x, "/assets/fallback.svg");
                v[key] = "/assets/fallback.svg";
              } else throw error;
            }
          else if (x && typeof x === "object") await localizeObject(x);
        }
      }
      const quests = { ru: {}, en: {} };
      for (const slug of slugs)
        for (const locale of ["ru", "en"]) {
          const raw = JSON.parse(
            await this.response(
              `${ORIGIN}/api/quest/${slug}?gameMode=regular&locale=${locale}`,
              2 * 1024 ** 2,
            ),
          );
          if (
            !raw.quest?.events?.some(
              (e) =>
                e.normalizedName === "halloween-2026" ||
                e.routeSlug === "halloween-2026-6",
            )
          )
            continue;
          const q = sanitizeEventQuest(raw, slug);
          await localizeObject(q);
          quests[locale][slug] = q;
        }
      const names = Object.keys(quests.ru);
      if (!names.length || names.some((s) => !quests.en[s]))
        throw Error("incomplete-languages");
      // A temporarily incomplete provider response must never remove a saved task.
      for (const locale of ["ru", "en"])
        for (const [slug, q] of Object.entries(
          this.bundle?.quests?.[locale] || {},
        ))
          quests[locale][slug] ??= q;
      const revision = crypto
        .createHash("sha256")
        .update(JSON.stringify(quests))
        .digest("hex");
      const bundle = {
        format: 1,
        revision,
        checkedAt: new Date(now).toISOString(),
        quests,
        media: Object.fromEntries(media),
      };
      const tmp = path.join(
        this.directory,
        "bundle-" + crypto.randomUUID() + ".tmp",
      );
      await fs.writeFile(tmp, JSON.stringify(bundle), { flag: "wx" });
      await fs.rename(tmp, path.join(this.directory, "bundle.json"));
      this.bundle = bundle;
      this.state = {
        phase: "current",
        checkedAt: bundle.checkedAt,
        lastSuccess: bundle.checkedAt,
      };
    } catch {
      this.state = { ...this.state, phase: "offline" };
    }
    return this.payload();
  }
  payload(revision) {
    return {
      state: this.state,
      revision: this.bundle?.revision || "",
      ...(revision && revision === this.bundle?.revision
        ? { unchanged: true }
        : { data: this.bundle }),
    };
  }
  async asset(name) {
    if (!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(name)) return null;
    await this.safeDirectory();
    const p = path.join(this.directory, "assets", name),
      s = await fs.lstat(p).catch(() => null);
    return s?.isFile() && !s.isSymbolicLink() && s.size <= 4 * 1024 ** 2
      ? p
      : null;
  }
  start({ isActive = () => true } = {}) {
    void this.check();
    this.timer = setInterval(() => {
      if (isActive()) void this.check();
    }, EVENT_CHECK_INTERVAL);
    this.timer.unref?.();
  }
  stop() {
    clearInterval(this.timer);
  }
}
