// Public creator profile URLs only. Leave empty until payment and payout are verified.
// Never put tokens, bank details or payment API keys in this file.
export const supportLinks = Object.freeze({ boosty: "", kofi: "", discord: "" });
export const supportCommunity = Object.freeze({ goal: null, confirmedSponsors: 0, sponsors: [], boosters: [] });

export function supportUrl(provider, value = supportLinks[provider]) {
  const hosts = { boosty: "boosty.to", kofi: "ko-fi.com" };
  if ((!hosts[provider] && provider !== "discord") || typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash) return null;
    if (provider === "discord") {
      if (!((url.hostname === "discord.gg" && /^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) ||
            (url.hostname === "discord.com" && /^\/invite\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)))) return null;
    } else if (url.hostname !== hosts[provider] || !/^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
