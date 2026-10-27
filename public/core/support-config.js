// Public creator profile URLs only. Leave empty until payment and payout are verified.
// Never put tokens, bank details or payment API keys in this file.
export const supportLinks = Object.freeze({ boosty: "", kofi: "" });

export function supportUrl(provider, value = supportLinks[provider]) {
  const hosts = { boosty: "boosty.to", kofi: "ko-fi.com" };
  if (!hosts[provider] || typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== hosts[provider] || url.port ||
        url.username || url.password || !/^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname) ||
        url.search || url.hash) return null;
    return url.href;
  } catch { return null; }
}
