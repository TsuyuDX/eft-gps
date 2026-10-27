const allowed = (key) =>
  key === "tarkov-interface-v1" ||
  key === "tarkov-locale-v1" || key === "tarkov-onboarding-v1" ||
  /^map-filters-v2-(regular|pve)-[a-z0-9-]+$/.test(key);
let pending = Promise.resolve();
export function readWindowSetting(key) {
  return localStorage.getItem(key);
}
function snapshot() {
  const values = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (allowed(key)) values[key] = localStorage.getItem(key);
  }
  return { version: 1, values };
}
function persist() {
  const body = JSON.stringify(snapshot());
  pending = pending
    .catch(() => {})
    .then(async () => {
      const response = await fetch("/api/window-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) throw Error("Настройки не записаны");
    })
    .catch(() => window.dispatchEvent(new Event("settings-save-failed")));
}
export function writeWindowSetting(key, value) {
  if (!allowed(key)) throw Error("Неизвестная настройка");
  localStorage.setItem(key, value);
  persist();
}
export async function loadWindowSettings() {
  try {
    const response = await fetch("/api/window-settings");
    if (!response.ok) return;
    const saved = await response.json();
    if (saved?.version === 1 && saved.values) {
      for (const [key, value] of Object.entries(saved.values))
        if (allowed(key) && typeof value === "string")
          localStorage.setItem(key, value);
    } else if (Object.keys(snapshot().values).length) persist();
  } catch {
    /* Local settings remain available if an older service is running. */
  }
}
