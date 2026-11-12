import fs from "node:fs/promises";
import { interfaceTexts } from "../public/locales/index.js";
import { templates } from "../public/locales/templates.js";
// Проверка выполняется до сборки. Ничего не скачивает и не изменяет.
export async function checkLocalization() {
  const issues = [];
  for (const [source, item] of Object.entries(interfaceTexts)) {
    if (
      !source.trim() ||
      typeof item?.ru !== "string" ||
      !item.ru.trim() ||
      typeof item?.en !== "string" ||
      !item.en.trim()
    )
      issues.push("Нет RU/EN: " + source);
  }
  const slots = (s) =>
    [...s.matchAll(/__V\d+__/g)]
      .map((x) => x[0])
      .sort()
      .join(",");
  for (const item of templates)
    for (const lang of ["ru", "en"])
      if (
        typeof item[lang] !== "string" ||
        slots(item.source) !== slots(item[lang])
      )
        issues.push("Переменные " + lang + ": " + item.source);
  for (const lang of ["ru", "en"]) {
    const a = JSON.parse(
      await fs.readFile(
        new URL("../scripts/native." + lang + ".json", import.meta.url),
        "utf8",
      ),
    );
    const b = JSON.parse(
      await fs.readFile(
        new URL("../.github/native/native." + lang + ".json", import.meta.url),
        "utf8",
      ),
    );
    if (JSON.stringify(a) !== JSON.stringify(b))
      issues.push("Копия нативного словаря не совпадает: " + lang);
    for (const [key, value] of Object.entries(a))
      if (typeof value !== "string" || !value.trim())
        issues.push("Пустая нативная подпись: " + key);
  }
  return issues;
}
if (
  process.argv[1] &&
  new URL(import.meta.url).pathname.endsWith(
    process.argv[1].replaceAll("\\", "/").split("/").at(-1),
  )
) {
  const issues = await checkLocalization();
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "Локализация: " +
        Object.keys(interfaceTexts).length +
        " подписей, " +
        templates.length +
        " шаблонов; RU/EN и нативные словари проверены.",
    );
}
