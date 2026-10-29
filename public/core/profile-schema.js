const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const safeKeys = (v) => Object.keys(v).length <= 100000 && Object.keys(v).every(k => k.length <= 300 && !["__proto__", "prototype", "constructor"].includes(k));
const strings = (v) => Array.isArray(v) && v.length <= 20000 && v.every(x => typeof x === "string" && x.length <= 300);
export function validProfile(p) {
  if (!record(p) || p.version !== 1 || !["regular", "pve"].includes(p.mode) || !record(p.modes)) return false;
  return ["regular", "pve"].every(mode => {
    const m = p.modes[mode];
    if (!record(m) || !["quests", "objectives", "inventory", "hideout", "pins"].every(k => record(m[k]) && safeKeys(m[k]))) return false;
    if (!strings(m.favorites) || !strings(m.modifiers) || typeof m.notes !== "string" || m.notes.length > 1000000) return false;
    if (![...Object.values(m.quests), ...Object.values(m.objectives)].every(v => typeof v === "boolean")) return false;
    if (![...Object.values(m.inventory), ...Object.values(m.hideout)].every(v => Number.isSafeInteger(v) && v >= 0)) return false;
    return Object.values(m.pins).every(pins => Array.isArray(pins) && pins.length <= 10000 && pins.every(pin =>
      record(pin) && Number.isFinite(pin.x) && Number.isFinite(pin.y) && typeof pin.name === "string" && pin.name.length <= 100 &&
      (pin.layer === "" || (typeof pin.layer === "string" && /^\d{1,3}$/.test(pin.layer)) || (Number.isSafeInteger(pin.layer) && pin.layer >= 0))));
  });
}
