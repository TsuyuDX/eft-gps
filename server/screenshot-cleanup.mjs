import fs from "node:fs";
import path from "node:path";
import { parseScreenshot } from "../public/core/gps-format.js";

export class ScreenshotCleanup {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.session = null;
    this.pending = new Map();
    this.deleted = 0;
    this.bytes = 0;
    this.error = "";
    this.generation = 0;
  }
  begin(folder) {
    const directory = fs.realpathSync(folder);
    const existing = new Set(fs.readdirSync(directory));
    this.session = { directory, existing, startedAt: this.now() };
    this.error = "";
    return this.session;
  }
  end() {
    this.session = null;
  }
  cancel() {
    this.end();
    this.pending.clear();
    this.generation++;
    this.error = "";
  }
  track(session, name, stat) {
    if (!session || session !== this.session || session.existing.has(name))
      return;
    if (
      name !== path.basename(name) ||
      !parseScreenshot(name) ||
      stat.mtimeMs < session.startedAt
    )
      return;
    const file = path.resolve(session.directory, name);
    if (path.dirname(file) !== session.directory || this.pending.has(file))
      return;
    this.pending.set(file, {
      directory: session.directory,
      size: stat.size,
      mtime: stat.mtimeMs,
      ino: stat.ino,
      dev: stat.dev,
      stableSince: this.now(),
      firstSeen: this.now(),
    });
  }
  async flush() {
    const generation = this.generation;
    for (const [file, record] of this.pending) {
      try {
        if (this.now() - record.firstSeen > 60000) {
          this.pending.delete(file);
          continue;
        }
        const directory = await fs.promises.realpath(record.directory);
        if (generation !== this.generation) return;
        if (
          directory !== record.directory ||
          path.dirname(file) !== directory
        ) {
          this.pending.delete(file);
          continue;
        }
        const stat = await fs.promises.lstat(file);
        if (generation !== this.generation) return;
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          stat.ino !== record.ino ||
          stat.dev !== record.dev
        ) {
          this.pending.delete(file);
          continue;
        }
        if (stat.size !== record.size || stat.mtimeMs !== record.mtime) {
          record.size = stat.size;
          record.mtime = stat.mtimeMs;
          record.stableSince = this.now();
          continue;
        }
        // Wait for a complete, unchanged file; never remove an image while it is growing.
        if (
          this.now() - record.stableSince < 2000 ||
          this.now() - stat.mtimeMs < 2000 ||
          !stat.size
        )
          continue;
        if (generation !== this.generation) return;
        await fs.promises.unlink(file);
        this.pending.delete(file);
        this.deleted++;
        this.bytes += stat.size;
        this.error = "";
      } catch (error) {
        if (generation !== this.generation) return;
        if (error.code === "ENOENT") this.pending.delete(file);
        else {
          this.error = "Не удалось удалить GPS-скриншот: " + error.message;
          if (this.now() - record.firstSeen > 60000) this.pending.delete(file);
        }
      }
    }
  }
  state() {
    return {
      deleted: this.deleted,
      bytes: this.bytes,
      pending: this.pending.size,
      error: this.error,
    };
  }
}
