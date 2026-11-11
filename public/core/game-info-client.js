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
  const poll = async () => {
    await refreshGameInfo();
    setTimeout(poll, state.phase === "checking" ? 1500 : INFO_INTERVAL);
  };
  void poll();
}
