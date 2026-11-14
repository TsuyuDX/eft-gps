import { normalizeOverlaySettings, validOverlaySettings } from "../public/core/overlay-settings.js";

// The native desktop window owns Overlay. This coordinator never starts a process.
export class OverlayManager {
  constructor(root, port, {platform = process.platform, clock = Date.now} = {}) {
    this.platform = platform;
    this.clock = clock;
    this.enabled = false;
    this.settings = normalizeOverlaySettings(null);
    this.runtime = null;
  }
  state() {
    const attached = !!this.runtime && this.clock() - this.runtime.at < 10000;
    return {
      enabled: this.enabled, attached,
      running: this.enabled && attached && this.runtime.running,
      visible: this.enabled && attached && this.runtime.visible,
      error: attached ? this.runtime.error : "",
      hotkeyRegistered: this.enabled && attached && this.runtime.hotkeyRegistered,
      settings: {...this.settings}, integrated: true,
    };
  }
  async setEnabled(enabled, settings) {
    if (typeof enabled !== "boolean") throw Error("invalid-overlay-state");
    if (enabled && this.platform !== "win32") throw Error("overlay-windows-only");
    if (settings !== undefined) {
      if (!validOverlaySettings(settings)) throw Error("invalid-overlay-settings");
      this.settings = normalizeOverlaySettings(settings);
    }
    this.enabled = enabled;
    return this.state();
  }
  report(value) {
    if (!value || typeof value !== "object" ||
        Object.keys(value).some(key => !["running", "visible", "error", "hotkeyRegistered"].includes(key)) ||
        !["running", "visible", "hotkeyRegistered"].every(key => typeof value[key] === "boolean") ||
        !["", "hotkey-in-use", "map-unavailable", "overlay-start-failed"].includes(value.error))
      throw Error("invalid-overlay-runtime");
    this.runtime = {...value, at:this.clock()};
    return this.state();
  }
  dispose() { this.enabled = false; this.runtime = null; }
}
