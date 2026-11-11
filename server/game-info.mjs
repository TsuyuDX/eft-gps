import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  sanitizeGameInfo,
  mergeGameInfo,
  INFO_INTERVAL,
} from "../public/core/game-info-model.js";
export const INFO_FEED_URL =
  "https://raw.githubusercontent.com/TsuyuDX/eft-gps/content-feed/feed.json";
export class GameInfoService {
  constructor(
    root,
    {
      fetcher = fetch,
      clock = Date.now,
      network = process.env.EFTGPS_NO_EVENT_NETWORK !== "1",
    } = {},
  ) {
    this.root = root;
    this.fetcher = fetcher;
    this.clock = clock;
    this.network = network;
    this.file = path.join(root, "userdata/game-info/feed.json");
    this.state = { phase: "bundled", lastSuccess: null, lastAttempt: null };
    this.ready = this.load();
    this.pending = null;
    this.lastAttempt = 0;
  }
  async safeDirectory(create = false) {
    for (const folder of [
      path.join(this.root, "userdata"),
      path.dirname(this.file),
    ]) {
      if (create) await fs.mkdir(folder, { recursive: true });
      try {
        const stat = await fs.lstat(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw Error("unsafe-info-cache");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
  async load() {
    this.data = sanitizeGameInfo(
      JSON.parse(
        await fs.readFile(
          path.join(this.root, "public/data/game-info.json"),
          "utf8",
        ),
      ),
    );
    try {
      await this.safeDirectory();
      const stat = await fs.lstat(this.file);
      if (
        stat.isSymbolicLink() ||
        !stat.isFile() ||
        stat.size > 2 * 1024 * 1024
      )
        throw Error("unsafe-info-cache");
      this.data = mergeGameInfo(
        this.data,
        sanitizeGameInfo(JSON.parse(await fs.readFile(this.file, "utf8"))),
      );
      this.state.phase = "cached";
    } catch (e) {
      if (e.code !== "ENOENT") this.state.phase = "cache-unavailable";
    }
    this.state.lastSuccess = this.data.lastSuccess;
  }
  async check({ force = false } = {}) {
    await this.ready;
    if (!this.network) return this.payload();
    if (this.pending) return this.pending;
    const now = this.clock();
    if (
      this.lastAttempt &&
      now - this.lastAttempt < (force ? 60000 : INFO_INTERVAL)
    )
      return this.payload();
    this.lastAttempt = now;
    this.state.lastAttempt = new Date(now).toISOString();
    this.state.phase = "checking";
    this.pending = (async () => {
      try {
        const r = await this.fetcher(INFO_FEED_URL, {
          redirect: "error",
          signal: AbortSignal.timeout(12000),
          headers: { "User-Agent": "EFTGPS-game-information" },
        });
        if (!r.ok) throw Error("feed-unavailable");
        const chunks = [];
        let size = 0;
        for await (const b of r.body) {
          size += b.length;
          if (size > 2 * 1024 * 1024) throw Error("feed-too-large");
          chunks.push(Buffer.from(b));
        }
        const incoming = sanitizeGameInfo(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
        if (
          !incoming.generatedAt ||
          Date.parse(incoming.generatedAt) > now + 300000 ||
          (this.data.generatedAt &&
            incoming.generatedAt < this.data.generatedAt)
        )
          throw Error("invalid-feed-date");
        const merged = mergeGameInfo(this.data, incoming);
        await this.safeDirectory(true);
        const temp =
          this.file + "." + crypto.randomBytes(8).toString("hex") + ".tmp";
        try {
          await fs.writeFile(temp, JSON.stringify(merged), { flag: "wx" });
          await fs.rename(temp, this.file);
        } finally {
          await fs.unlink(temp).catch(() => {});
        }
        this.data = merged;
        this.state.phase = "current";
        this.state.lastSuccess = merged.lastSuccess;
      } catch {
        this.state.phase = "offline";
      }
      return this.payload();
    })().finally(() => (this.pending = null));
    return this.pending;
  }
  payload() {
    return { state: { ...this.state }, data: this.data };
  }
}
