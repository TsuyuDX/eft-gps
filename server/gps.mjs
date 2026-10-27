import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { parseScreenshot, parseLogLine } from "../public/core/gps-format.js";
import { ScreenshotCleanup } from "./screenshot-cleanup.mjs";
export class GpsService {
  constructor(root, { allowInput = true } = {}) {
    this.root = root;
    this.allowInput = allowInput;
    this.configFile = path.join(root, "userdata/gps-settings.json");
    this.config = {
      enabled: false,
      screenshotsPath: path.join(
        os.homedir(),
        "Documents",
        "Escape From Tarkov",
        "Screenshots",
      ),
      logsPath: "",
      map: "customs",
      interval: 2,
      key: "PrintScreen",
      autoMap: true,
      autoFloor: true,
      follow: false,
      deleteAutoScreenshots: true,
    };
    try {
      Object.assign(this.config, JSON.parse(fs.readFileSync(this.configFile)));
    } catch {}
    this.fix = null;
    this.raid = "unknown";
    this.detectedMap = null;
    this.detectedMode = null;
    this.auto = false;
    this.manualRaid = false;
    this.captureStatus = "off";
    this.message = "";
    this.seen = new Map();
    this.logs = new Map();
    this.helper = null;
    this.lastClient = 0;
    this.busy = false;
    this.startedAt = Date.now();
    this.scanCount = 0;
    this.cleanup = new ScreenshotCleanup();
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 750);
    this.timer.unref();
    this.tick();
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.stopAuto();
    this.cleanup.cancel();
  }
  settings(next) {
    const c = { ...this.config };
    for (const key of [
      "enabled",
      "autoMap",
      "autoFloor",
      "follow",
      "deleteAutoScreenshots",
    ])
      if (key in next) {
        if (typeof next[key] !== "boolean")
          throw Error("Неверная настройка " + key);
        c[key] = next[key];
      }
    for (const key of ["screenshotsPath", "logsPath"])
      if (key in next) {
        const value = String(next[key] || "").trim();
        if (value && (!path.isAbsolute(value) || value.startsWith("\\\\")))
          throw Error("Укажите локальный абсолютный путь");
        if (value && fs.existsSync(value) && !fs.statSync(value).isDirectory())
          throw Error("Нужно выбрать папку");
        c[key] = value;
      }
    if ("interval" in next) {
      const n = Number(next.interval);
      if (!Number.isFinite(n) || n < 1 || n > 30)
        throw Error("Интервал должен быть от 1 до 30 секунд");
      c.interval = n;
    }
    if ("key" in next) {
      if (!["PrintScreen", "F12", "F11", "Insert"].includes(next.key))
        throw Error("Неподдерживаемая клавиша");
      c.key = next.key;
    }
    if ("map" in next) {
      if (
        !/^[a-z0-9-]+$/.test(next.map) ||
        !fs.existsSync(
          path.join(this.root, "public/data/maps", next.map + ".json"),
        )
      )
        throw Error("Неизвестная карта");
      c.map = next.map;
    }
    this.stopAuto();
    this.cleanup.cancel();
    if (c.screenshotsPath !== this.config.screenshotsPath) {
      this.seen.clear();
      this.fix = null;
    }
    if (c.logsPath !== this.config.logsPath) {
      this.logs.clear();
      this.raid = "unknown";
      this.detectedMap = null;
    }
    if (c.map !== this.config.map) this.fix = null;
    this.config = c;
    fs.mkdirSync(path.dirname(this.configFile), { recursive: true });
    fs.writeFileSync(this.configFile + ".tmp", JSON.stringify(c, null, 2));
    fs.renameSync(this.configFile + ".tmp", this.configFile);
    this.tick();
    return this.state();
  }
  state() {
    this.lastClient = Date.now();
    return {
      config: this.config,
      fix: this.fix,
      raid: this.raid,
      map:
        this.config.autoMap && this.detectedMap
          ? this.detectedMap
          : this.config.map,
      detectedMode: this.detectedMode,
      auto: this.auto,
      manualRaid: this.manualRaid,
      captureStatus: this.captureStatus,
      message: this.message,
      cleanup: this.cleanup.state(),
      folderExists: fs.existsSync(this.config.screenshotsPath),
      logsExist: !!this.config.logsPath && fs.existsSync(this.config.logsPath),
      helperExists: fs.existsSync(
        path.join(this.root, "runtime/GpsCapture.exe"),
      ),
    };
  }
  startAuto(manualRaid = false) {
    if (!this.allowInput)
      throw Error("Автонажатия отключены в тестовом режиме");
    if (!this.config.enabled)
      throw Error("Сначала включите GPS и сохраните настройки");
    if (!fs.existsSync(this.config.screenshotsPath))
      throw Error("Папка скриншотов не найдена");
    if (this.raid !== "active" && !manualRaid)
      throw Error(
        "Логи пока не подтвердили начало рейда. Можно вручную подтвердить, что вы уже в рейде.",
      );
    this.stopAuto();
    if (this.config.deleteAutoScreenshots)
      this.cleanup.begin(this.config.screenshotsPath);
    this.auto = true;
    this.manualRaid = !!manualRaid;
    this.message = "";
    this.lastClient = Date.now();
    this.captureStatus = "waiting";
    const helper = path.join(this.root, "runtime/GpsCapture.exe");
    this.helper = spawn(
      helper,
      [
        "--interval",
        String(Math.round(this.config.interval * 1000)),
        "--key",
        this.config.key,
        "--parent",
        String(process.pid),
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    this.helper.stdout.setEncoding("utf8");
    this.helper.stdin.on("error", () => {});
    this.helper.stdout.on("data", (chunk) => {
      for (const line of chunk.trim().split(/\r?\n/)) {
        if (["paused", "capturing", "input-blocked"].includes(line))
          this.captureStatus = line;
      }
    });
    this.helper.on("error", (e) => {
      this.cleanup.end();
      this.message = "Не удалось запустить автосъёмку: " + e.message;
      this.auto = false;
      this.helper = null;
      this.captureStatus = "off";
    });
    const processRef = this.helper;
    this.helper.on("exit", () => {
      if (this.helper === processRef) {
        this.cleanup.end();
        this.helper = null;
        this.auto = false;
        this.captureStatus = "off";
      }
    });
    return this.state();
  }
  stopAuto() {
    this.cleanup.end();
    this.auto = false;
    this.manualRaid = false;
    this.captureStatus = "off";
    if (this.helper) {
      const child = this.helper;
      this.helper = null;
      child.stdin.end("stop\n");
      const t = setTimeout(() => {
        if (child.exitCode === null) child.kill();
      }, 1000);
      t.unref();
    }
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      if (this.auto && Date.now() - this.lastClient > 45000) {
        this.stopAuto();
        this.message =
          "Автосъёмка остановлена: окно приложения не поддерживает связь.";
      }
      if (this.config.deleteAutoScreenshots) await this.cleanup.flush();
      if (!this.config.enabled) return;
      if (this.config.logsPath && ++this.scanCount % 3 === 0)
        await this.readLogs();
      if (
        !this.config.screenshotsPath ||
        !fs.existsSync(this.config.screenshotsPath)
      ) {
        this.message =
          "Папка скриншотов не найдена. Укажите её в настройках GPS.";
        return;
      }
      const session =
        this.auto && this.config.deleteAutoScreenshots
          ? this.cleanup.session
          : null;
      const files = await fs.promises.readdir(this.config.screenshotsPath);
      const candidates = [];
      for (const name of files) {
        if (this.seen.has(name)) continue;
        const parsed = parseScreenshot(name);
        if (!parsed) continue;
        const stat = await fs.promises
          .lstat(path.join(this.config.screenshotsPath, name))
          .catch(() => null);
        if (!stat?.isFile() || stat.isSymbolicLink()) continue;
        const signature = stat.mtimeMs;
        this.seen.set(name, signature);
        candidates.push({ name, parsed, mtime: signature });
        this.cleanup.track(session, name, stat);
      }
      const latest = candidates.sort((a, b) => b.mtime - a.mtime)[0];
      if (latest && (!this.fix || latest.mtime > this.fix.updatedAt)) {
        this.fix = {
          ...latest.parsed,
          file: latest.name,
          updatedAt: latest.mtime,
          map:
            this.config.autoMap && this.detectedMap
              ? this.detectedMap
              : this.config.map,
          mode: this.detectedMode,
        };
        this.message = "";
      }
    } catch (e) {
      this.message = "Ошибка чтения GPS: " + e.message;
    } finally {
      this.busy = false;
    }
  }
  async readLogs() {
    const folder = this.config.logsPath;
    if (!fs.existsSync(folder)) return;
    const files = [];
    const entries = await fs.promises.readdir(folder, { withFileTypes: true });
    for (const e of entries) {
      if (
        e.isFile() &&
        /application.*\.log$|(?:push-)?notifications.*\.log$/i.test(e.name)
      )
        files.push(path.join(folder, e.name));
      if (e.isDirectory() && /^log_/i.test(e.name)) {
        for (const f of await fs.promises.readdir(path.join(folder, e.name)))
          if (/application.*\.log$|(?:push-)?notifications.*\.log$/i.test(f))
            files.push(path.join(folder, e.name, f));
      }
    }
    const stats = (
      await Promise.all(
        files.map(async (file) => ({
          file,
          stat: await fs.promises.stat(file),
        })),
      )
    )
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .slice(0, 3)
      .sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);
    for (const { file, stat } of stats) {
      let offset =
          this.logs.get(file)?.offset ?? Math.max(0, stat.size - 512 * 1024),
        carry = this.logs.get(file)?.carry || "";
      if (stat.size < offset) {
        offset = 0;
        carry = "";
      }
      if (stat.size === offset) continue;
      const length = Math.min(1024 * 1024, stat.size - offset);
      const handle = await fs.promises.open(file, "r");
      let buffer = Buffer.alloc(length);
      try {
        await handle.read(buffer, 0, length, offset);
      } finally {
        await handle.close();
      }
      const text = carry + buffer.toString("utf8"),
        lines = text.split(/\r?\n/);
      carry = lines.pop();
      this.logs.set(file, { offset: offset + length, carry });
      for (const line of lines) {
        const event = parseLogLine(line);
        if (!event) continue;
        if (event.mode) this.detectedMode = event.mode;
        if (event.map) {
          if (event.map !== this.detectedMap) this.fix = null;
          this.detectedMap = event.map;
        }
        if (event.raid) {
          this.raid = event.raid;
          if (event.raid === "ended" || event.raid === "loading") {
            this.stopAuto();
            this.fix = null;
          }
        }
      }
    }
  }
}
