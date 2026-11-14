// Browser storage is a cache. A full/blocked cache must not prevent disk saves.
const memory = new Map();
export function readLocal(key) {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) memory.set(key, value);
    return value ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}
export function writeLocal(key, value) {
  memory.set(key, String(value));
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
export function localEntries() {
  const values = new Map(memory);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) values.set(key, localStorage.getItem(key));
    }
  } catch { /* Retain the in-memory values when storage is unavailable. */ }
  return values;
}
