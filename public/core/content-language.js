import { language, setContentTranslations } from "./localization.js";
let resources = null,
  pending = null;
export async function englishResources() {
  if (resources) return resources;
  if (!pending)
    pending = Promise.all(
      ["index.json", "strings.json"].map(async (name) => {
        const response = await fetch("/data/en/" + name);
        if (!response.ok)
          throw Error(
            "The offline English language pack is missing. Reinstall EFT GPS.",
          );
        return response.json();
      }),
    )
      .then(([index, strings]) => {
        resources = { files: new Set(index.files), ...strings };
        setContentTranslations(strings.byText);
        return resources;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  return pending;
}
export function translateContent(value, pack) {
  if (typeof value === "string") return pack.byText[value] || value;
  if (Array.isArray(value)) return value.map((v) => translateContent(v, pack));
  if (!value || typeof value !== "object") return value;
  const output = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      translateContent(item, pack),
    ]),
  );
  for (const [field, suffix] of [
    ["name", "Name"],
    ["shortName", "ShortName"],
    ["description", "Description"],
  ])
    if (field in output && pack.byKey[value.id + " " + suffix])
      output[field] = pack.byKey[value.id + " " + suffix];
  if (output.name && pack.namesBySlug[value.normalizedName])
    output.name = pack.namesBySlug[value.normalizedName];
  return output;
}
export async function contentPath(url, locale = language()) {
  if (locale !== "en") return { url, pack: null };
  const pack = await englishResources();
  return { url: pack.files.has(url) ? "en/" + url : url, pack };
}
