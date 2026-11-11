import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const maxBytes = 12 * 1024 * 1024;
export function rasterInfo(bytes) {
  if (bytes.length < 24 || bytes.length > maxBytes)
    throw Error("Недопустимый размер изображения");
  let width, height, ext;
  if (
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR"
  ) {
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
    ext = "png";
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    ext = "jpg";
    let pos = 2;
    while (pos + 4 <= bytes.length) {
      if (bytes[pos++] !== 255) break;
      while (bytes[pos] === 255) pos++;
      const marker = bytes[pos++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (pos + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(pos);
      if (length < 2 || pos + length > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 8
      ) {
        height = bytes.readUInt16BE(pos + 3);
        width = bytes.readUInt16BE(pos + 5);
        break;
      }
      pos += length;
    }
  }
  if (
    !ext ||
    !(
      width > 0 &&
      height > 0 &&
      width <= 8192 &&
      height <= 8192 &&
      width * height <= 40000000
    )
  )
    throw Error("Нужен PNG или JPEG до 12 МБ и 40 мегапикселей");
  return { width, height, ext };
}
export class GraphicsGallery {
  constructor(userRoot) {
    this.userRoot = userRoot;
    this.root = path.join(userRoot, "graphics-gallery");
    this.pending = Promise.resolve();
  }
  async directory(create = false) {
    for (const folder of [this.userRoot, this.root]) {
      if (create) await fs.mkdir(folder, { recursive: true });
      try {
        const stat = await fs.lstat(folder);
        if (stat.isSymbolicLink() || !stat.isDirectory())
          throw Error("Небезопасная папка галереи");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
  async list() {
    await this.directory();
    try {
      const stat = await fs.lstat(path.join(this.root, "index.json"));
      if (!stat.isFile() || stat.isSymbolicLink())
        throw Error("Небезопасный индекс галереи");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    try {
      const list = JSON.parse(
        await fs.readFile(path.join(this.root, "index.json"), "utf8"),
      );
      return Array.isArray(list)
        ? list
            .filter((x) => /^[a-f0-9]{32}\.(png|jpg)$/.test(x.id))
            .slice(0, 20)
        : [];
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }
  async save(list) {
    await this.directory(true);
    const file = path.join(this.root, "index.json"),
      temp = file + "." + crypto.randomBytes(8).toString("hex") + ".tmp";
    try {
      await fs.writeFile(temp, JSON.stringify(list), { flag: "wx" });
      await fs.rename(temp, file);
    } finally {
      await fs.unlink(temp).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    }
  }
  serialize(action) {
    const result = this.pending.catch(() => {}).then(action);
    this.pending = result;
    return result;
  }
  add(bytes, location) {
    return this.serialize(async () => {
      const info = rasterInfo(bytes),
        list = await this.list();
      if (
        list.length >= 20 ||
        list.reduce((n, x) => n + x.bytes, 0) + bytes.length > 160 * 1024 * 1024
      )
        throw Error("Галерея заполнена: удалите ненужные скриншоты");
      const id = crypto.randomBytes(16).toString("hex") + "." + info.ext;
      const item = {
        id,
        location: String(location || "Другая локация")
          .replace(/[\x00-\x1f\x7f]/g, "")
          .slice(0, 60),
        width: info.width,
        height: info.height,
        bytes: bytes.length,
        createdAt: new Date().toISOString(),
      };
      await this.directory(true);
      await fs.writeFile(path.join(this.root, id), bytes, { flag: "wx" });
      try {
        await this.save([...list, item]);
      } catch (e) {
        await fs.unlink(path.join(this.root, id)).catch(() => {});
        throw e;
      }
      return item;
    });
  }
  remove(id) {
    return this.serialize(async () => {
      if (!/^[a-f0-9]{32}\.(png|jpg)$/.test(id))
        throw Error("Неизвестный скриншот");
      const list = await this.list();
      if (!list.some((x) => x.id === id)) return;
      await this.save(list.filter((x) => x.id !== id));
      await fs.unlink(path.join(this.root, id)).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    });
  }
  async image(id) {
    if (!/^[a-f0-9]{32}\.(png|jpg)$/.test(id)) return null;
    const list = await this.list();
    if (!list.some((x) => x.id === id)) return null;
    const file = path.join(this.root, id),
      stat = await fs.lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile())
      throw Error("Небезопасный файл изображения");
    return fs.readFile(file);
  }
}
export async function graphicsGalleryRoute(gallery, req, res, url) {
  if (!url.pathname.startsWith("/api/graphics-gallery")) return false;
  res.setHeader("Cache-Control", "no-store");
  try {
    if (url.pathname === "/api/graphics-gallery" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(await gallery.list()));
      return true;
    }
    if (url.pathname === "/api/graphics-gallery" && req.method === "POST") {
      if (req.headers.origin !== `http://${req.headers.host}`) {
        res.writeHead(403);
        res.end();
        return true;
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes) {
          res.writeHead(413);
          res.end();
          req.destroy();
          return true;
        }
        chunks.push(chunk);
      }
      const item = await gallery.add(
        Buffer.concat(chunks),
        url.searchParams.get("location"),
      );
      res.setHeader("Content-Type", "application/json");
      res.writeHead(201);
      res.end(JSON.stringify(item));
      return true;
    }
    const id = url.pathname.slice("/api/graphics-gallery/".length);
    if (req.method === "DELETE") {
      if (req.headers.origin !== `http://${req.headers.host}`) {
        res.writeHead(403);
        res.end();
        return true;
      }
      await gallery.remove(id);
      res.writeHead(204);
      res.end();
      return true;
    }
    if (req.method === "GET") {
      const bytes = await gallery.image(id);
      if (!bytes) {
        res.writeHead(404);
        res.end();
        return true;
      }
      res.setHeader(
        "Content-Type",
        id.endsWith(".png") ? "image/png" : "image/jpeg",
      );
      res.end(bytes);
      return true;
    }
    res.writeHead(405);
    res.end();
    return true;
  } catch (e) {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return true;
  }
}
