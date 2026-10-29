import { validProfile } from "./profile-schema.js";
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
    const p = await r.json();
    if (p) state = validate(p);
    else {
      const s = localStorage.getItem("tarkov-offline-v1");
      if (s) state = validate(JSON.parse(s));
    }
  } catch (e) {
    const s = localStorage.getItem("tarkov-offline-v1");
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
  localStorage.setItem("tarkov-offline-v1", JSON.stringify(state));
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
export function setMode(mode) {
  state.mode = mode;
  save();
}
export function replaceState(p) {
  state = structuredClone(validate(p));
  save();
}
export function inventory(id, value) {
  current().inventory[id] = Math.max(0, Math.floor(Number(value) || 0));
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
  current().hideout[id] = Math.max(0, Math.floor(Number(level) || 0));
  save();
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
