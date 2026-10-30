// Public creator links only. Payments are handled by the external provider.
// Never put tokens, bank details or payment API keys in this file.
export const supportLinks = Object.freeze({
  boosty: "https://boosty.to/tsuyueftgps/donate",
  boostySubscription: "https://boosty.to/tsuyueftgps/purchase/4150607",
  kofi: "",
  discord: "https://discord.gg/ESMU7RDUEq",
});
export const supportCommunity = Object.freeze({
  goal: null,
  confirmedSponsors: 0,
  sponsors: [],
  boosters: [],
});

export function supportUrl(provider, value = supportLinks[provider]) {
  const hosts = {
    boosty: "boosty.to",
    boostySubscription: "boosty.to",
    kofi: "ko-fi.com",
  };
  if (
    (!hosts[provider] && provider !== "discord") ||
    typeof value !== "string" ||
    !value.trim()
  )
    return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    if (provider === "discord") {
      if (!(
        (url.hostname === "discord.gg" &&
          /^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) ||
        (url.hostname === "discord.com" &&
          /^\/invite\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname))
      ))
        return null;
    } else if (provider === "boosty" || provider === "boostySubscription") {
      const path =
        provider === "boostySubscription"
          ? /^\/[a-zA-Z0-9_-]+\/purchase\/[0-9]+\/?$/
          : /^\/[a-zA-Z0-9_-]+(?:\/donate)?\/?$/;
      if (url.hostname !== "boosty.to" || !path.test(url.pathname)) return null;
    } else if (
      url.hostname !== hosts[provider] ||
      !/^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
