// App routes act as keyboard-accessible links without Edge's URL hover preview.
// External sources open separately, without URL hover chrome inside the app.
const installed = new WeakSet();
export function installAppNavigation(doc = document, host = window) {
  if (installed.has(doc)) return;
  installed.add(doc);
  function prepareLink(link) {
    const href = link.getAttribute("href");
    if (!href) return;
    let target;
    try {
      target = new URL(href, host.location.href);
    } catch {
      return;
    }
    if (
      target.origin !== host.location.origin &&
      /^https?:$/.test(target.protocol)
    ) {
      link.dataset.externalUrl = target.href;
      delete link.dataset.appRoute;
    } else if (
      target.origin !== host.location.origin ||
      target.pathname !== "/" ||
      !target.hash.startsWith("#/")
    )
      return;
    else {
      link.dataset.appRoute = target.hash;
      delete link.dataset.externalUrl;
    }
    link.removeAttribute("href");
    link.setAttribute("role", "link");
    if (!link.hasAttribute("tabindex")) link.tabIndex = 0;
  }
  function prepare(root) {
    if (root.nodeType === 1 && root.matches("a[href]")) prepareLink(root);
    root.querySelectorAll?.("a[href]").forEach(prepareLink);
  }
  prepare(doc);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") prepareLink(record.target);
      else for (const node of record.addedNodes) prepare(node);
    }
  });
  observer.observe(doc, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["href"],
  });
  function activate(event) {
    if (event.defaultPrevented) return;
    const link = event.target.closest?.(
      "a[data-app-route],a[data-external-url]",
    );
    if (!link) return;
    if (event.type === "keydown" && event.key !== "Enter") return;
    if (event.type === "click" && event.button !== 0) return;
    if (event.type === "auxclick" && event.button !== 1) return;
    event.preventDefault();
    if (link.dataset.externalUrl) {
      host.open(link.dataset.externalUrl, "_blank", "noopener");
      return;
    }
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.button === 1 ||
      link.target === "_blank"
    ) {
      host.open("/" + link.dataset.appRoute, "_blank", "noopener");
    } else host.location.hash = link.dataset.appRoute;
  }
  doc.addEventListener("click", activate);
  doc.addEventListener("auxclick", activate);
  doc.addEventListener("keydown", activate);
}
