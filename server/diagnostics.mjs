import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const categories = new Set([
  "startup",
  "interface",
  "update",
  "network",
  "server",
]);
const codes = new Set([
  "started",
  "ui-error",
  "slow-operation",
  "operation-failed",
  "unavailable",
  "checksum",
  "disk-space",
  "download-size",
  "installer-missing",
  "installer-access",
  "installer-start",
  "download-timeout",
]);
export const diagnosticPolicyVersion = 1;
// Никакой сетевой отправки. Сервис будет подключаться отдельно с новым согласием.
export class Diagnostics {
  constructor(userRoot, version, { clock = Date.now } = {}) {
    this.folder = path.join(userRoot, "diagnostics");
    this.userRoot = userRoot;
    this.version = version;
    this.clock = clock;
    this.enabled = false;
    this.storageError = false;
    this.events = [];
    this.queue = Promise.resolve();
    this.recent = new Map();
    this.ready = this.load();
  }
  async safe(create = false) {
    for (const folder of [this.userRoot, this.folder]) {
      if (create) await fs.mkdir(folder, { recursive: true });
      try {
        const s = await fs.lstat(folder);
        if (s.isSymbolicLink() || !s.isDirectory())
          throw Error("unsafe-diagnostics-folder");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
  async read(name) {
    await this.safe();
    const file = path.join(this.folder, name),
      s = await fs.lstat(file);
    if (s.isSymbolicLink() || !s.isFile() || s.size > 256 * 1024)
      throw Error("unsafe-diagnostics-file");
    return JSON.parse(await fs.readFile(file, "utf8"));
  }
  async write(name, value) {
    await this.safe(true);
    const file = path.join(this.folder, name);
    try {
      if ((await fs.lstat(file)).isSymbolicLink())
        throw Error("unsafe-diagnostics-file");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const tmp = file + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(tmp, JSON.stringify(value), { flag: "wx" });
      await fs.rename(tmp, file);
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  }
  valid(event) {
    return (
      event &&
      Object.keys(event).every((k) =>
        ["category", "code", "durationMs", "at"].includes(k),
      ) &&
      (event.at === undefined ||
        (typeof event.at === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00.000Z$/.test(event.at))) &&
      categories.has(event.category) &&
      codes.has(event.code) &&
      (event.durationMs === undefined ||
        (Number.isFinite(event.durationMs) &&
          event.durationMs >= 0 &&
          event.durationMs <= 86400000))
    );
  }
  async load() {
    try {
      const saved = await this.read("consent.json");
      this.enabled =
        saved.enabled === true &&
        saved.policyVersion === diagnosticPolicyVersion;
      if (this.enabled) {
        const report = await this.read("report.json").catch(() => null);
        this.events = (report?.events || [])
          .filter(
            (x) =>
              this.valid(x) && Date.parse(x.at) > this.clock() - 7 * 86400000,
          )
          .slice(-300);
      }
    } catch {
      this.enabled = false;
    }
  }
  state() {
    return {
      enabled: this.enabled,
      policyVersion: diagnosticPolicyVersion,
      events: this.events.length,
      uploadConfigured: false,
      storage: "local",
      storageAvailable: !this.storageError,
      retentionDays: 7,
    };
  }
  async consent(enabled, policyVersion) {
    await this.ready;
    if (
      typeof enabled !== "boolean" ||
      policyVersion !== diagnosticPolicyVersion
    )
      throw Error("invalid-diagnostic-consent");
    await this.queue;
    await this.write("consent.json", {
      enabled,
      policyVersion,
      at: new Date(this.clock()).toISOString(),
    });
    this.enabled = enabled;
    if (!enabled) await this.clear();
    return this.state();
  }
  record(event) {
    if (!this.enabled || !this.valid(event)) return Promise.resolve();
    const key = event.category + ":" + event.code,
      now = this.clock();
    if (now - (this.recent.get(key) || 0) < 30000) return Promise.resolve();
    this.recent.set(key, now);
    const entry = {
      at: new Date(Math.floor(now / 60000) * 60000).toISOString(),
      category: event.category,
      code: event.code,
    };
    if (event.durationMs !== undefined)
      entry.durationMs = Math.min(
        600000,
        Math.round(event.durationMs / 100) * 100,
      );
    this.queue = this.queue
      .then(async () => {
        if (!this.enabled) return;
        this.events = this.events
          .filter((x) => Date.parse(x.at) > this.clock() - 7 * 86400000)
          .slice(-299);
        this.events.push(entry);
        await this.write("report.json", this.report());
      })
      .catch(() => {
        this.storageError = true;
      });
    return this.queue;
  }
  report() {
    return {
      format: 1,
      appVersion: this.version,
      platform: process.platform,
      osVersion: os.release().split(".").slice(0, 2).join("."),
      uploadConfigured: false,
      events: this.events.slice(),
    };
  }
  async clear() {
    await this.queue;
    await this.safe();
    this.events = [];
    this.recent.clear();
    const file = path.join(this.folder, "report.json");
    try {
      const s = await fs.lstat(file);
      if (s.isSymbolicLink()) throw Error("unsafe-diagnostics-file");
      await fs.unlink(file);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return this.state();
  }
}
import crypto from "node:crypto";
