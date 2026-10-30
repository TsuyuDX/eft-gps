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
        (key === "tarkov-map-markers-v1" ||
          key === "tarkov-interface-v1" ||
          key === "tarkov-locale-v1" ||
          key === "tarkov-onboarding-v1" ||
          /^map-filters-v2-(regular|pve)-[a-z0-9-]+$/.test(key)) &&
        typeof text === "string" &&
        text.length <= 32000 &&
        (() => {
          try {
            const data = JSON.parse(text);
            return (
              data &&
              typeof data === "object" &&
              !Array.isArray(data) &&
              (key !== "tarkov-map-markers-v1" ||
                (["new", "classic"].includes(data.style) &&
                  Object.keys(data).length === 1))
            );
          } catch {
            return false;
          }
        })(),
    )
  );
}
