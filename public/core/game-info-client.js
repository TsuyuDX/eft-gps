import { sanitizeGameInfo, INFO_INTERVAL } from "./game-info-model.js";
let data = { version: 1, records: [], sources: [] },
  state = { phase: "bundled", lastSuccess: null },
  pending,
  started = false;
export const gameInfo = () => data;
export const gameInfoState = () => state;
export async function refreshGameInfo() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch("/api/game-info", {
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      if (!response.ok) throw Error("unavailable");
      const result = await response.json();
      data = sanitizeGameInfo(result.data);
      state = result.state || state;
    } catch {
      state = { ...state, phase: "offline" };
    } finally {
      window.dispatchEvent(new Event("game-info-updated"));
      pending = null;
    }
  })();
  return pending;
}
export async function initializeGameInfo() {
  try {
    const response = await fetch("/data/game-info.json");
    if (response.ok) data = sanitizeGameInfo(await response.json());
  } catch {}
  void refreshGameInfo();
}
export function startGameInfo() {
  if (started) return;
  started = true;
  let timer;
  const schedule = (delay) => { clearTimeout(timer); timer = setTimeout(poll, delay); };
  const poll = async () => { await refreshGameInfo(); schedule(state.phase === "checking" ? 1500 : INFO_INTERVAL); };
  // Manual checks receive their result promptly even while the hourly timer is pending.
  window.addEventListener("game-info-updated", () => { if (state.phase === "checking") schedule(1500); });
  void poll();
}
