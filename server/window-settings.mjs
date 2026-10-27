export function validWindowSettings(value) {
  if (
    !value ||
    value.version !== 1 ||
    !value.values ||
    typeof value.values !== "object" ||
    Array.isArray(value.values)
  )
    return false;
  const entries = Object.entries(value.values);
  return (
    entries.length <= 40 &&
    entries.every(
      ([key, text]) =>
        (key === "tarkov-interface-v1" ||
          key === "tarkov-locale-v1" ||
          /^map-filters-v2-(regular|pve)-[a-z0-9-]+$/.test(key)) &&
        typeof text === "string" &&
        text.length <= 32000 &&
        (() => {
          try {
            const data = JSON.parse(text);
            return data && typeof data === "object" && !Array.isArray(data);
          } catch {
            return false;
          }
        })(),
    )
  );
}
