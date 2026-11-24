import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  itemNameIndex,
  matchItemLines,
  recognitionConfig,
  traderQuotes,
} from "../public/core/item-recognition-model.js";
const execute = promisify(execFile);
export class ItemRecognition {
  constructor(root, { content, profile, fetcher = fetch, ocr } = {}) {
    this.root = root;
    this.dir = path.join(root, "userdata/item-recognition");
    this.content = content;
    this.profile = profile;
    this.fetcher = fetcher;
    this.ocr = ocr || this.windowsOcr.bind(this);
    this.config = recognitionConfig();
    this.state = {
      phase: "off",
      error: "",
      result: null,
      languages: [],
      processed: 0,
    };
    this.hashes = new Set();
    this.indices = new Map();
    this.lastAt = 0;
    this.startedAt = Date.now();
    this.ready = this.load().catch(() => {
      this.config.enabled = false;
      this.state.phase = "error";
      this.state.error = "Настройки OCR недоступны";
    });
    this.generation = 0;
  }
  async directory() {
    for (const p of [path.join(this.root, "userdata"), this.dir]) {
      await fs.mkdir(p, { recursive: true });
      const stat = await fs.lstat(p);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw Error("Unsafe OCR directory");
    }
  }
  async read(name) {
    try {
      const p = path.join(this.dir, name);
      const s = await fs.lstat(p);
      if (!s.isFile() || s.isSymbolicLink() || s.size > 4 * 1024 ** 2)
        return null;
      return JSON.parse(await fs.readFile(p, "utf8"));
    } catch {
      return null;
    }
  }
  async load() {
    await this.directory();
    this.config = recognitionConfig((await this.read("settings.json")) || {});
    this.prices = (await this.read("prices.json")) || {};
    this.state.phase = this.config.enabled ? "waiting" : "off";
  }
  async save(name, value) {
    await this.directory();
    const p = path.join(this.dir, name),
      tmp = p + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(tmp, JSON.stringify(value), { flag: "wx" });
      await fs.rename(tmp, p);
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  }
  async settings(value) {
    await this.ready;
    this.config = recognitionConfig(value);
    this.generation++;
    if (!this.config.enabled) {
      this.abort?.abort();
      this.state.result = null;
    }
    await this.save("settings.json", this.config);
    this.state.phase = this.config.enabled ? "waiting" : "off";
    return this.snapshot();
  }
  snapshot() {
    return { ...this.state, config: this.config };
  }
  async windowsOcr(file, signal) {
    const script = await fs.readFile(
      path.join(this.root, "scripts/read-item-text.ps1"),
      "utf8",
    );
    const command =
      "$ProgressPreference='SilentlyContinue';& { " +
      script +
      " } -Path '" +
      path.resolve(file).replaceAll("'", "''") +
      "'";
    const exe = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32/WindowsPowerShell/v1.0/powershell.exe",
    );
    const { stdout } = await execute(
      exe,
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { windowsHide: true, timeout: 20000, maxBuffer: 256 * 1024, signal },
    );
    return JSON.parse(stdout.trim());
  }
  async index(mode) {
    if (!this.indices.has(mode)) {
      const rows = [];
      for (const lang of ["", "en/"]) {
        const p = path.join(this.root, "public/data", lang, mode, "items.json");
        rows.push(...JSON.parse(await fs.readFile(p, "utf8")));
      }
      this.indices.set(mode, itemNameIndex(rows));
    }
    return this.indices.get(mode);
  }
  async enqueue(file, mode = "regular") {
    await this.ready;
    if (
      !this.config.enabled ||
      this.busy ||
      Date.now() - this.lastAt < this.config.interval * 1000
    )
      return;
    const stat = await fs.lstat(file).catch(() => null);
    if (
      !stat?.isFile() ||
      stat.isSymbolicLink() ||
      stat.size > 32 * 1024 ** 2 ||
      stat.mtimeMs < this.startedAt - 1000
    )
      return;
    this.busy = true;
    this.lastAt = Date.now();
    const generation = this.generation;
    let copy;
    try {
      const bytes = await fs.readFile(file);
      const hash = crypto.createHash("sha256").update(bytes).digest("hex");
      if (this.hashes.has(hash)) {
        this.busy = false;
        return;
      }
      this.hashes.add(hash);
      while (this.hashes.size > 64)
        this.hashes.delete(this.hashes.values().next().value);
      await this.directory();
      copy = path.join(this.dir, crypto.randomUUID() + path.extname(file));
      await fs.writeFile(copy, bytes, { flag: "wx" });
      this.abort = new AbortController();
      this.pending = this.analyze(
        copy,
        mode,
        generation,
        this.abort.signal,
      ).finally(async () => {
        await fs.unlink(copy).catch(() => {});
        this.busy = false;
      });
    } catch {
      if (copy) await fs.unlink(copy).catch(() => {});
      this.busy = false;
      this.state.error = "Не удалось прочитать снимок";
    }
  }
  async analyze(file, mode, generation, signal) {
    try {
      this.state.phase = "recognizing";
      const output = await this.ocr(file, signal);
      if (generation !== this.generation) return;
      this.state.languages = output.languages || [];
      if (!output.languages?.length)
        throw Error(
          "Установите русский или английский язык OCR в дополнительных компонентах Windows.",
        );
      this.state.processed++;
      const item = matchItemLines(output.lines || [], await this.index(mode));
      if (!item) {
        this.state.phase = "waiting";
        this.state.error = "";
        return;
      }
      const now = Date.now();
      if (
        this.state.result?.slug === item.normalizedName &&
        now - this.state.result.at < 30000
      ) {
        this.state.phase = "waiting";
        return;
      }
      const price = this.config.prices ? await this.price(item, mode) : null;
      let quests = [];
      if (this.config.quests) {
        try {
          const relative = `data/${mode === "pve" ? "pve/" : ""}items/${item.normalizedName}.json`;
          const p = await this.content.file(relative);
          const detail = p
            ? JSON.parse(await fs.readFile(p, "utf8")).item
            : null;
          const progress = this.profile?.read()?.modes?.[mode]?.quests || {};
          const known = JSON.parse(
            await fs.readFile(
              path.join(this.root, "public/data", mode, "quests.json"),
              "utf8",
            ),
          );
          const active = new Set(
            known
              .filter((q) => !q.isPastEventQuest)
              .map((q) => q.normalizedName),
          );
          quests = (detail?.questsFor || [])
            .filter(
              (q) =>
                active.has(q.normalizedName) &&
                Number.isInteger(q.count) &&
                q.count > 0 &&
                !progress[q.normalizedName] &&
                !progress[q.id],
            )
            .map((q) => ({
              name: q.name,
              count: q.count,
              slug: q.normalizedName,
            }));
        } catch {}
      }
      if (generation !== this.generation) return;
      const shownAt = Date.now();
      this.state.result = {
        slug: item.normalizedName,
        name: item.name,
        icon: item.iconLink,
        at: shownAt,
        expiresAt: shownAt + this.config.duration * 1000,
        mode,
        price,
        quests,
      };
      this.state.phase = "waiting";
      this.state.error = "";
    } catch (e) {
      if (generation === this.generation) {
        this.state.phase = "error";
        this.state.error = signal.aborted
          ? "Распознавание остановлено"
          : e.code === "ENOENT"
            ? "Компонент OCR Windows недоступен"
            : "Не удалось распознать снимок. Проверьте языки OCR Windows и формат изображения.";
      }
    }
  }
  async price(item, mode) {
    const id = item.iconLink?.match(/\b([a-f0-9]{24})\b/)?.[1];
    if (!id) return { error: "Нет идентификатора цены" };
    const key = mode + ":" + id,
      cached = this.prices[key];
    if (cached && Date.now() - cached.at < 15 * 60 * 1000)
      return {
        ...cached,
        quotes: traderQuotes(cached.item, this.config),
        cached: true,
      };
    if (this.priceBackoff > Date.now())
      return cached
        ? {
            ...cached,
            quotes: traderQuotes(cached.item, this.config),
            stale: true,
          }
        : { error: "Источник цен временно недоступен" };
    try {
      const query =
        "query Price($ids:[ID!],$mode:GameMode){items(ids:$ids,gameMode:$mode){id name normalizedName lastLowPrice avg24hPrice updated types sellFor{priceRUB vendor{name normalizedName} requirements{type value}}}}";
      const r = await this.fetcher("https://api.tarkov.dev/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { ids: [id], mode } }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error("Price HTTP " + r.status);
      const text = await r.text();
      if (text.length > 256 * 1024) throw Error("Price response too large");
      const data = JSON.parse(text);
      const record = data.data?.items?.find((v) => v.id === id);
      if (data.errors || !record || !Array.isArray(record.sellFor))
        throw Error("Нет подтверждённой цены");
      const value = {
        at: Date.now(),
        item: record,
        source: "https://tarkov.dev/item/" + item.normalizedName,
      };
      this.prices[key] = value;
      if (Object.keys(this.prices).length > 500)
        delete this.prices[Object.keys(this.prices)[0]];
      await this.save("prices.json", this.prices);
      return { ...value, quotes: traderQuotes(record, this.config) };
    } catch {
      this.priceBackoff = Date.now() + 5 * 60 * 1000;
      return cached
        ? {
            ...cached,
            quotes: traderQuotes(cached.item, this.config),
            stale: true,
          }
        : { error: "Источник цен временно недоступен" };
    }
  }
}
