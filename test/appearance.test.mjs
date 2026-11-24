import test from "node:test";
import assert from "node:assert/strict";
import { validWindowSettings } from "../server/window-settings.mjs";
const snapshot = (x) => ({
  version: 1,
  values: { "eftgps-appearance-v1": JSON.stringify(x) },
});
test("appearance settings preserve supported fonts, scales and explicit motion preference", () => {
  for (const scale of [90, 100, 110, 125])
    for (const font of ["system", "arial", "tahoma"])
      assert.equal(
        validWindowSettings(snapshot({ scale, font, animations: false })),
        true,
      );
});
test("appearance imports reject invalid zoom, injected fonts and malformed animation flags", () => {
  for (const value of [
    { scale: 0, font: "system", animations: true },
    { scale: 100, font: "url(http://example.com)", animations: true },
    { scale: 125, font: "arial", animations: "false" },
  ])
    assert.equal(validWindowSettings(snapshot(value)), false);
});
