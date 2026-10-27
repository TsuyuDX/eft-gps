import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import {
  installDesktopUi,
  isBrowserShortcut,
} from "../public/core/desktop-ui.js";

test("browser shortcuts are blocked without taking app navigation or editing keys", () => {
  for (const event of [
    { key: "F11" },
    { key: "F12" },
    { key: "F5" },
    { key: "l", ctrlKey: true },
    { key: "s", ctrlKey: true },
    { key: "p", ctrlKey: true },
    { key: "r", ctrlKey: true },
    { key: "I", ctrlKey: true, shiftKey: true },
    { key: "ArrowLeft", altKey: true },
    { key: "+", ctrlKey: true },
  ])
    assert.equal(isBrowserShortcut(event), true, JSON.stringify(event));
  for (const event of [
    { key: "Escape" },
    { key: "F4", altKey: true },
    { key: "k", ctrlKey: true },
    { key: "c", ctrlKey: true },
    { key: "v", ctrlKey: true },
    { key: "x", ctrlKey: true },
    { key: "a", ctrlKey: true },
    { key: "z", ctrlKey: true },
    { key: "s" },
    { key: "ArrowLeft", ctrlKey: true },
  ])
    assert.equal(isBrowserShortcut(event), false, JSON.stringify(event));
});

test("capture cancels browser commands even in inputs and embedded documents", () => {
  const { document, window } = parseHTML(
    '<input value="Ключ"><button>Поиск</button>',
  );
  installDesktopUi(document);
  installDesktopUi(document);
  const input = document.querySelector("input");
  for (const key of ["F11", "s", "p", "l"]) {
    const event = new window.Event("keydown", {
      bubbles: true,
      cancelable: true,
    });
    Object.assign(event, { key, ctrlKey: key !== "F11" });
    input.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true, key);
  }
  for (const key of ["a", "c", "v", "k"]) {
    const event = new window.Event("keydown", {
      bubbles: true,
      cancelable: true,
    });
    Object.assign(event, { key, ctrlKey: true });
    input.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, key);
  }
  const wheel = new window.Event("wheel", { bubbles: true, cancelable: true });
  wheel.ctrlKey = true;
  input.dispatchEvent(wheel);
  assert.equal(wheel.defaultPrevented, true);
});
