import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { Connectivity } from "../server/connectivity.mjs";
import { setLanguage } from "../public/core/localization.js";
import { startConnectivityStatus } from "../public/core/connectivity.js";

test("connectivity uses a fixed probe, shares in-flight requests and caches a validated response", async () => {
  let calls = 0,
    time = 100;
  const monitor = new Connectivity({
    now: () => time,
    ttl: 30,
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, "http://www.msftconnecttest.com/connecttest.txt");
      assert.equal(options.redirect, "manual");
      return new Response("Microsoft Connect Test");
    },
  });
  const first = monitor.check();
  assert.equal(first, monitor.check());
  assert.equal((await first).online, true);
  await monitor.check();
  assert.equal(calls, 1);
  time += 31;
  await monitor.check();
  assert.equal(calls, 2);
});

test("offline errors, captive portals, redirects and oversized responses never report online", async () => {
  for (const fetcher of [
    async () => {
      throw Error("Offline");
    },
    async () => new Response("Portal login"),
    async () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://portal.invalid" },
      }),
    async () => new Response("X".repeat(256)),
  ])
    assert.equal((await new Connectivity({ fetcher }).check()).online, false);
});

test("connection indicator switches green/red, responds offline immediately and translates RU/EN without changing the computer network", async () => {
  const { document, window } = parseHTML(
    '<html><body><a id="connection-status"><i class="connection-dot"></i><span data-connection-label></span></a></body></html>',
  );
  const saved = {
    Event: globalThis.Event,
    document: globalThis.document,
    window: globalThis.window,
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    localStorage: globalThis.localStorage,
  };
  Object.assign(globalThis, {
    document,
    window,
    Event: window.Event,
    localStorage: { getItem: () => null, setItem: () => {} },
  });
  let connected = true,
    requests = 0;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      get onLine() {
        return connected;
      },
    },
  });
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ online: true });
  };
  globalThis.setTimeout = () => 1;
  globalThis.clearTimeout = () => {};
  setLanguage("ru", { persist: false });
  let stop;
  try {
    stop = startConnectivityStatus();
    for (let i = 0; i < 12; i++) await Promise.resolve();
    const badge = document.querySelector("#connection-status");
    assert.match(badge.textContent, /Онлайн/);
    assert.equal(badge.classList.contains("is-online"), true);
    connected = false;
    window.dispatchEvent(new window.Event("offline"));
    assert.match(badge.textContent, /Оффлайн/);
    assert.equal(badge.classList.contains("is-offline"), true);
    assert.equal(requests, 1);
    setLanguage("en", { persist: false });
    window.dispatchEvent(new window.Event("language-changed"));
    assert.equal(badge.textContent, "Offline");
    connected = true;
    window.dispatchEvent(new window.Event("online"));
    for (let i = 0; i < 12; i++) await Promise.resolve();
    assert.equal(badge.textContent, "Online");
    assert.equal(requests, 2);
  } finally {
    stop?.();
    Object.assign(globalThis, {
      document: saved.document,
      window: saved.window,
      Event: saved.Event,
      fetch: saved.fetch,
      setTimeout: saved.setTimeout,
      clearTimeout: saved.clearTimeout,
      localStorage: saved.localStorage,
    });
    if (saved.navigator)
      Object.defineProperty(globalThis, "navigator", saved.navigator);
    else delete globalThis.navigator;
  }
});
