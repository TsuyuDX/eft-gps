export let gpsState = null;
let timer = null,
  previousMap = null,
  previousFix = null;
export async function gpsRequest(url, value) {
  const response = await fetch(
    "/api/gps/" + url,
    value === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "GPS недоступен. Перезапустите приложение.");
  return data;
}
export async function pollGps() {
  try {
    gpsState = await gpsRequest("state");
    window.dispatchEvent(new CustomEvent("gps-update", { detail: gpsState }));
    return gpsState;
  } catch {
    return null;
  }
}
export function startGpsClient(getMode) {
  if (timer) return;
  const badge = document.createElement("a");
  badge.id = "gps-pill";
  badge.className = "pill";
  badge.href = "#/gps";
  badge.textContent = "⌖ GPS";
  document.querySelector(".statusline .row")?.append(badge);
  window.addEventListener("gps-update", ({ detail: s }) => {
    badge.classList.toggle("gps-on", s.config.enabled);
    badge.textContent = s.auto
      ? "⌖ GPS · авто"
      : s.config.enabled
        ? "⌖ GPS · вкл"
        : "⌖ GPS · выкл";
    if (
      s.config.enabled &&
      s.config.autoMap &&
      s.fix &&
      Date.now() - s.fix.updatedAt < 60000 &&
      s.fix.updatedAt !== previousFix
    ) {
      if (previousMap !== s.fix.map)
        location.hash = "/map/" + (s.fix.mode || getMode()) + "/" + s.fix.map;
      previousMap = s.fix.map;
    }
    if (!s.config.enabled) previousMap = null;
    previousFix = s.fix?.updatedAt;
  });
  pollGps();
  timer = setInterval(pollGps, 1000);
}
