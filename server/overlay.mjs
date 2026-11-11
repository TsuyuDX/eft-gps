import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
export class OverlayManager {
  constructor(
    root,
    port,
    { spawnProcess = spawn, platform = process.platform } = {},
  ) {
    this.root = root;
    this.port = port;
    this.spawnProcess = spawnProcess;
    this.platform = platform;
    this.enabled = false;
    this.child = null;
    this.error = "";
    this.transition = Promise.resolve();
  }
  state() {
    return {
      enabled: this.enabled,
      running: !!this.child && this.child.exitCode === null,
      error: this.error,
    };
  }
  setEnabled(enabled) {
    this.transition = this.transition
      .catch(() => {})
      .then(async () => {
        if (!enabled) {
          this.enabled = false;
          await this.stop();
          return this.state();
        }
        if (this.child && this.child.exitCode === null) {
          this.enabled = true;
          return this.state();
        }
        if (this.platform !== "win32") throw Error("overlay-windows-only");
        this.error = "";
        const child = this.spawnProcess(
          path.join(this.root, "runtime", "EFTGPSOverlay.exe"),
          ["--app-port", String(this.port)],
          { cwd: this.root, stdio: "ignore", windowsHide: false },
        );
        this.child = child;
        this.enabled = true;
        child.once("error", () => {
          if (this.child === child) {
            this.error = "overlay-start-failed";
            this.enabled = false;
            this.child = null;
          }
        });
        child.once("exit", (code) => {
          if (this.child === child) {
            this.child = null;
            if (this.enabled)
              this.error = code ? "overlay-exited" : "overlay-closed";
          }
        });
        try {
          await once(child, "spawn");
          child.unref?.();
        } catch {
          this.enabled = false;
          this.child = null;
          throw Error("overlay-start-failed");
        }
        return this.state();
      });
    return this.transition;
  }
  async stop() {
    const child = this.child;
    if (!child) return;
    // Integrated host observes enabled=false and closes its own windows gracefully.
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (child.exitCode === null) child.kill();
        resolve();
      }, 3500);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (this.child === child) this.child = null;
  }
  dispose() {
    this.enabled = false;
    if (this.child && this.child.exitCode === null) this.child.kill();
    this.child = null;
  }
}
