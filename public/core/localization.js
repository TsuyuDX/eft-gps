import { englishUi } from "./english-ui.js";
import { interfaceTexts } from "../locales/index.js";
import { translatePattern } from "./english-patterns.js";
import { readWindowSetting, writeWindowSetting } from "./window-settings.js";
// Тексты редактируются в public/locales; здесь только выбор языка и обновление DOM.
const words = englishUi;
let extraWords = {};
export function setContentTranslations(value) {
  extraWords = value || {};
}
export const localeCode = () => (locale === "en" ? "en-US" : "ru-RU");
let locale = "ru",
  observer = null;
const originals = new WeakMap();
export const language = () => locale;
export function savedLanguage() {
  try {
    const value = JSON.parse(readWindowSetting("tarkov-locale-v1"));
    return ["ru", "en"].includes(value?.language) ? value.language : null;
  } catch {
    return null;
  }
}
// Для компонентов с явными парами RU/EN. Общий каталог имеет приоритет над резервной строкой.
export function textPair(ru, en) {
  const item = interfaceTexts[String(ru)] ?? interfaceTexts[String(ru).trim()];
  return item
    ? locale === "en"
      ? item.en
      : item.ru
    : locale === "en"
      ? en || t(ru)
      : ru;
}
export function t(text) {
  if (text == null) return text;
  if (locale === "ru") {
    const value = String(text),
      source = value.trim();
    const item = interfaceTexts[source];
    return value.replace(
      source,
      item ? item.ru.trim() : translatePattern(source, "ru"),
    );
  }
  const value = String(text),
    trim = value.trim();
  let result = words[trim] ?? extraWords[trim];
  if (result === undefined) {
    result = translatePattern(trim);
  }
  result = result.replace(
    /(\d+)\s+(мин|точка|точки|точек)(?![а-яё])/gi,
    (_, count, unit) =>
      count +
      " " +
      (unit.toLowerCase() === "мин"
        ? "min"
        : Number(count) === 1
          ? "point"
          : "points"),
  );
  return value.replace(trim, result);
}
// Обновляет видимые подписи и атрибуты. Ввод пользователя и содержимое textarea не переводятся.
function translate(root) {
  if (!root || (!root.ownerDocument && root.nodeType !== 9)) return;
  const doc = root.ownerDocument || root;
  function node(n) {
    const old = originals.get(n);
    const source = old && n.nodeValue === old.output ? old.source : n.nodeValue;
    const output = t(source);
    originals.set(n, { source, output });
    if (n.nodeValue !== output) n.nodeValue = output;
  }
  if (root.nodeType === 3) {
    if (
      !root.parentElement?.closest("script,style,textarea,[data-no-translate]")
    )
      node(root);
    return;
  }
  const walker = doc.createTreeWalker(root, 4);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.parentElement?.closest("script,style,textarea,[data-no-translate]"))
      node(n);
  }
  for (const el of [
    ...(root.matches?.("[placeholder],[title],[aria-label]") ? [root] : []),
    ...(root.querySelectorAll?.("[placeholder],[title],[aria-label]") || []),
  ]) {
    if (el.closest("[data-no-translate]")) continue;
    let record = originals.get(el) || {};
    for (const key of ["placeholder", "title", "aria-label"]) {
      if (!el.hasAttribute(key)) continue;
      const actual = el.getAttribute(key),
        old = record[key];
      const source = old && actual === old.output ? old.source : actual;
      const output = t(source);
      record[key] = { source, output };
      if (actual !== output) el.setAttribute(key, output);
    }
    originals.set(el, record);
  }
}
// Меняет язык, сохраняет выбор и оповещает экраны, которые перерисовывают свои подписи.
export function setLanguage(value, { persist = true } = {}) {
  locale = ["ru", "en"].includes(value) ? value : "ru";
  document.documentElement.lang = locale;
  if (persist)
    writeWindowSetting(
      "tarkov-locale-v1",
      JSON.stringify({ language: locale }),
    );
  if (observer) observer.disconnect();
  translate(document.body);
  if (observer) observe();
  window.dispatchEvent(new Event("language-changed"));
}
function observe() {
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "title", "aria-label"],
  });
}
// Один наблюдатель обслуживает весь интерфейс, включая динамические окна и карты.
export function installLocalization() {
  if (observer) return;
  observer = new MutationObserver((records) => {
    observer.disconnect();
    for (const record of records) {
      if (record.type === "childList")
        for (const n of record.addedNodes) translate(n);
      else translate(record.target);
    }
    observe();
  });
  translate(document.body);
  observe();
}
export function languageControl(root) {
  const row = document.createElement("label");
  row.className = "preference-row";
  row.innerHTML =
    '<span><strong>Язык интерфейса</strong><small class="muted">Язык применяется к интерфейсу, предметам, заданиям и справочнику.</small></span><select aria-label="Язык интерфейса"><option value="ru">Русский</option><option value="en">English</option></select>';
  const select = row.querySelector("select");
  select.value = locale;
  select.onchange = () => setLanguage(select.value);
  root.prepend(row);
  translate(row);
}
