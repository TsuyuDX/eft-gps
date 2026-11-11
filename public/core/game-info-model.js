export const INFO_INTERVAL = 60 * 60 * 1000;
const hosts = new Set([
  "t.me",
  "www.escapefromtarkov.com",
  "escapefromtarkov.com",
  "forum.escapefromtarkov.com",
  "steamcommunity.com",
  "store.steampowered.com",
  "steamstore-a.akamaihd.net",
  "www.youtube.com",
  "youtube.com",
  "www.twitch.tv",
  "twitch.tv",
  "www.tiktok.com",
  "www.reddit.com",
  "reddit.com",
  "mrsouer.com",
  "www.tarkovhead.com",
  "tarkov.dev",
]);
export function infoSource(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      hosts.has(u.hostname) &&
      !/[\x00-\x1f]/.test(value)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function officialInfoSource(value,publisher) {
  try {
    const u = new URL(value);
    return (
      (["www.youtube.com","youtube.com"].includes(u.hostname) && u.pathname==="/watch" && publisher==="UC5QGploHhl9_XaxDiHZKamg") ||
      ["www.escapefromtarkov.com", "escapefromtarkov.com"].includes(
        u.hostname,
      ) ||
      (u.hostname === "t.me" &&
        /^\/escapefromtarkov(?:EN|RU)?\/[0-9]+$/.test(u.pathname)) ||
      (u.hostname === "steamstore-a.akamaihd.net" &&
        u.pathname.startsWith(
          "/news/externalpost/steam_community_announcements/",
        )) ||
      (u.hostname === "steamcommunity.com" &&
        u.pathname.startsWith("/app/3932890/announcements/"))
    );
  } catch {
    return false;
  }
}
const text = (x, n = 1200) => (typeof x === "string" ? x.slice(0, n) : "");
const date = (x) =>
  typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}(?:T[0-9:.+-]+Z?)?$/.test(x) &&
  Number.isFinite(Date.parse(x)) && new Date(x.slice(0,10)+"T12:00:00Z").toISOString().slice(0,10)===x.slice(0,10)
    ? x
    : null;
const localized = (x) =>
  typeof x === "string"
    ? { ru: text(x), en: text(x) }
    : { ru: text(x?.ru), en: text(x?.en) };
const modes = (x) =>
  Array.isArray(x)
    ? [...new Set(x.filter((v) => ["pvp", "pve", "season"].includes(v)))]
    : [];
export function sanitizeGameInfo(input) {
  if (
    !input ||
    input.version !== 1 ||
    !Array.isArray(input.records) ||
    input.records.length > 500
  )
    throw Error("invalid-info-feed");
  const records = [],
    seen = new Set();
  for (const item of input.records) {
    if (
      !/^[a-z0-9-]{1,100}$/.test(item.id) ||
      seen.has(item.id) ||
      !["news", "event", "season", "promo"].includes(item.type) ||
      !infoSource(item.source)
    )
      continue;
    seen.add(item.id);
    const verified =
      item.verified === "official"
        ? officialInfoSource(item.source,item.publisher)
          ? "official"
          : "unverified"
        : item.verified === "reviewed"
          ? "reviewed"
          : "unverified";
    const record = {
      id: item.id,
      type: item.type,
      title: localized(item.title),
      description: localized(item.description),
      source: infoSource(item.source),
      publisher:item.publisher==="UC5QGploHhl9_XaxDiHZKamg"?item.publisher:null,
      verified,
      publishedAt: date(item.publishedAt),
      checkedAt: date(item.checkedAt),
      modes: modes(item.modes),
      category: text(item.category, 40),
      image:
        typeof item.image === "string" &&
        /^\/assets\/news\/[a-z0-9-]+\.(png|jpg|webp)$/.test(item.image)
          ? item.image
          : null,
      startsAt: date(item.startsAt),
      endsAt: date(item.endsAt),
      endsOn: /^\d{4}-\d{2}-\d{2}$/.test(item.endsOn || "")
        ? date(item.endsOn)
        : null,
      endTimeConfirmed: item.endTimeConfirmed === true,
      active: item.active === true,
      endedConfirmed:item.endedConfirmed===true && verified!=="unverified",
      activitySource:infoSource(item.activitySource),
      confirmationExpiresAt: date(item.confirmationExpiresAt),
      guide:
        typeof item.guide === "string" &&
        /^#\/(event|season|quest|map)\/[a-z0-9/-]+$/.test(item.guide)
          ? item.guide
          : null,
      rewards: Array.isArray(item.rewards)
        ? item.rewards
            .slice(0, 20)
            .filter((x) => infoSource(x.source))
            .map((x) => ({
              title: localized(x.title),
              description: localized(x.description),
              verified:
                x.verified === "official" && officialInfoSource(x.source)
                  ? "official"
                  : x.verified === "reviewed"
                    ? "reviewed"
                    : "unverified",
              source: infoSource(x.source),
            }))
        : [],
      steps: Array.isArray(item.steps)
        ? item.steps.slice(0, 20).map(localized)
        : [],
    };
    if (item.type === "promo") {
      if (!/^[A-Z0-9_-]{3,64}$/.test(item.code || "")) continue;
      record.code = item.code;
      record.activationVerified =
        item.activationVerified === true && verified !== "unverified";
      record.permanentConfirmed =
        item.permanentConfirmed === true && verified !== "unverified";
      record.expiredConfirmed =
        item.expiredConfirmed === true && verified !== "unverified";
    }
    records.push(record);
  }
  return {
    version: 1,
    generatedAt: date(input.generatedAt),
    lastSuccess: date(input.lastSuccess),
    records,
    sources: Array.isArray(input.sources)
      ? input.sources
          .slice(0, 30)
          .filter((s) => infoSource(s.url))
          .map((s) => ({
            id: text(s.id, 80),
            name: text(s.name, 100),
            url: infoSource(s.url),
            status: [
              "connected",
              "unavailable",
              "requires-auth",
              "review-only",
            ].includes(s.status)
              ? s.status
              : "unavailable",
            reason: localized(s.reason),
            checkedAt: date(s.checkedAt),
          }))
      : [],
  };
}
export function recordState(record, now = Date.now()) {
  if (
    record.endedConfirmed ||
    record.expiredConfirmed ||
    (record.endsAt && Date.parse(record.endsAt) <= now) ||
    (record.endsOn &&
      Date.parse(record.endsOn + "T00:00:00Z") + 2 * 86400000 <= now)
  )
    return "archived";
  if (record.type === "promo")
    return record.activationVerified ? "verified" : "unverified";
  if (
    record.verified !== "unverified" &&
    record.active &&
    record.startsAt &&
    Date.parse(record.startsAt) <= now &&
    record.confirmationExpiresAt &&
    Date.parse(record.confirmationExpiresAt) > now
  )
    return "active";
  return "unconfirmed";
}
export function promoGroup(record, now = Date.now()) {
  return recordState(record, now) === "archived"
    ? "archive"
    : record.permanentConfirmed
      ? "permanent"
      : "temporary";
}
export function seasonRemaining(record, now = Date.now()) {
  if (
    record.type !== "season" ||
    record.verified === "unverified" ||
    !record.endsAt ||
    !record.endTimeConfirmed ||
    !record.endsAt.includes("T")
  )
    return null;
  const remaining = Math.max(0, Date.parse(record.endsAt) - now);
  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor(remaining / 3600000) % 24,
  };
}
export function mergeGameInfo(oldData, newData) {
  const merged = new Map(oldData.records.map((x) => [x.id, x]));
  for (const x of newData.records) merged.set(x.id, x);
  return sanitizeGameInfo({
    ...newData,
    records: [...merged.values()]
      .sort(
        (a, b) =>
          (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0),
      )
      .slice(0, 500),
  });
}
