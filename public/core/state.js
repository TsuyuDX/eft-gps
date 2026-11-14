import { validProfile } from "./profile-schema.js";
import { readLocal, writeLocal } from "./storage.js";
const blank = () => ({
  quests: {},
  objectives: {},
  inventory: {},
  hideout: {},
  favorites: [],
  pins: {},
  modifiers: [],
  notes: "",
});
let state = {
    version: 1,
    mode: "regular",
    modes: { regular: blank(), pve: blank() },
  },
  pending = Promise.resolve();
export function validate(p) {
  if (!validProfile(p)) throw Error("Неверный или повреждённый формат резервной копии");
  return p;
}
export async function loadState() {
  try {
    const r = await fetch("/api/profile");
    if (!r.ok) throw Error("Profile unavailable");
    const p = await r.json();
    if (r.headers?.get("X-EFTGPS-Profile-Recovered") === "1")
      loadState.recovered = true;
    if (p) state = validate(p);
    else {
      const s = readLocal("tarkov-offline-v1");
      if (s) state = validate(JSON.parse(s));
    }
  } catch (e) {
    const s = readLocal("tarkov-offline-v1");
    if (s)
      try {
        state = validate(JSON.parse(s));
      } catch {}
  }
  return state;
}
export const current = () => state.modes[state.mode];
export const profile = () => state;
export function save() {
  writeLocal("tarkov-offline-v1", JSON.stringify(state));
  const body = JSON.stringify(state);
  pending = pending
    .catch(() => {})
    .then(async () => {
      const r = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!r.ok) throw Error("Ошибка сохранения");
    })
    .catch(() => window.dispatchEvent(new Event("save-failed")));
  window.dispatchEvent(new Event("profile-updated"));
}
export function setMode(mode, { persist = true } = {}) {
  if (!["regular", "pve"].includes(mode)) throw Error("Invalid mode");
  state.mode = mode;
  if (persist) save();
}
export function replaceState(p) {
  state = structuredClone(validate(p));
  save();
}
export function inventory(id, value) {
  current().inventory[id] = safeCount(value);
  save();
}
export function toggleFavorite(id) {
  const a = current().favorites;
  const i = a.indexOf(id);
  i < 0 ? a.push(id) : a.splice(i, 1);
  save();
}
export function toggleQuest(id) {
  current().quests[id] = !current().quests[id];
  save();
}
export function toggleObjective(id) {
  current().objectives[id] = !current().objectives[id];
  save();
}
export function setHideout(id, level) {
  current().hideout[id] = safeCount(level);
  save();
}
function safeCount(value) {
  const count = Number(value);
  return Number.isFinite(count)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(count)))
    : 0;
}
export function exportProfile() {
  const a = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
  );
  a.href = url;
  a.download =
    "tarkov-progress-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
