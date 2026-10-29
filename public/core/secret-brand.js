// Visual parody branding, confined to the active document. No profile or files are changed.
const name = "Индекс Карты";
const logo = "/icons/index-maps.svg";
let observer, savedTitle;
const textRecords = new Map(),
  elementRecords = new Map(),
  iconRecords = new Map();
export function secretBrandText(value) {
  return String(value)
    .replace(/T_S_U_Y_U\s+EFT\s+GPS/g, name)
    .replace(/EFT\s+GPS/g, name)
    .replace(/EFTGPS/g, name);
}
function rememberElement(el, html) {
  if (elementRecords.has(el)) return;
  elementRecords.set(el, {
    html: el.innerHTML,
    noTranslate: el.hasAttribute("data-no-translate"),
  });
  el.setAttribute("data-no-translate", "");
  el.innerHTML = html;
}
function refresh() {
  observer?.disconnect();
  document.title = name + " · Тарков";
  for (const el of document.querySelectorAll(".brand strong"))
    rememberElement(
      el,
      '<span class="index-wordmark"><b>И</b>ндекс <span>Карты</span></span>',
    );
  for (const el of document.querySelectorAll(".home-hero h1"))
    rememberElement(
      el,
      '<span class="index-wordmark"><b>И</b>ндекс <span>Карты</span></span>',
    );
  for (const el of document.querySelectorAll(
    'img[src="/icons/app-192.png"],#logo,link[rel="icon"],link[rel="apple-touch-icon"]',
  )) {
    const attr = el.tagName.toLowerCase() === "link" ? "href" : "src";
    if (!iconRecords.has(el))
      iconRecords.set(el, {
        attr,
        value: el.getAttribute(attr),
        alt: el.getAttribute("alt"),
        type: el.getAttribute("type"),
      });
    el.setAttribute(attr, logo);
    if (attr === "src") el.setAttribute("alt", name);
    else el.setAttribute("type", "image/svg+xml");
  }
  const walker = document.createTreeWalker(document.body, 4);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (
      node.parentElement?.closest(
        "script,style,textarea,input,[contenteditable],[data-no-translate]",
      )
    )
      continue;
    const output = secretBrandText(node.nodeValue);
    if (output !== node.nodeValue) {
      textRecords.set(node, { source: node.nodeValue, output });
      node.nodeValue = output;
    }
  }
  for (const el of document.querySelectorAll(
    "[title],[aria-label],[placeholder]",
  )) {
    if (el.matches("input,textarea,[contenteditable]")) continue;
    for (const attr of ["title", "aria-label", "placeholder"]) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const output = secretBrandText(value);
      if (value === output) continue;
      if (!iconRecords.has(el)) iconRecords.set(el, {});
      const record = iconRecords.get(el);
      record.attributes ??= {};
      record.attributes[attr] ??= value;
      el.setAttribute(attr, output);
    }
  }
  for (const [node] of textRecords)
    if (!node.isConnected) textRecords.delete(node);
  observer?.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
export function startSecretBrand() {
  savedTitle = document.title;
  if (typeof MutationObserver !== "undefined")
    observer = new MutationObserver(refresh);
  refresh();
  window.chrome?.webview?.postMessage("secret-brand-on");
}
export function stopSecretBrand() {
  observer?.disconnect();
  observer = null;
  for (const [node, value] of textRecords)
    if (node.nodeValue === value.output) node.nodeValue = value.source;
  for (const [el, value] of elementRecords) {
    el.innerHTML = value.html;
    if (!value.noTranslate) el.removeAttribute("data-no-translate");
  }
  for (const [el, value] of iconRecords) {
    if (value.attr) {
      if (value.value == null) el.removeAttribute(value.attr);
      else el.setAttribute(value.attr, value.value);
      if (value.alt == null) el.removeAttribute("alt");
      else el.setAttribute("alt", value.alt);
      if (value.type == null) el.removeAttribute("type");
      else el.setAttribute("type", value.type);
    }
    for (const [attr, source] of Object.entries(value.attributes || {}))
      el.setAttribute(attr, source);
  }
  textRecords.clear();
  elementRecords.clear();
  iconRecords.clear();
  if (savedTitle !== undefined) document.title = savedTitle;
  window.chrome?.webview?.postMessage("secret-brand-off");
}
