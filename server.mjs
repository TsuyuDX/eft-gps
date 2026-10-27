import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(root, "public"),
  userRoot = path.join(root, "userdata");
const port = Number(process.env.PORT || 38471);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};
export function safePath(base, name) {
  const p = path.resolve(base, "." + name);
  return p.startsWith(base + path.sep) ? p : null;
}
export function validProfile(p) {
  return (
    p &&
    p.version === 1 &&
    p.modes &&
    ["regular", "pve"].every(
      (k) => p.modes[k] && typeof p.modes[k] === "object",
    )
  );
}
let lastPing = Date.now();
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:" + port);
    if (
      req.headers.host !== `127.0.0.1:${port}` &&
      req.headers.host !== `localhost:${port}`
    ) {
      res.writeHead(403);
      return res.end("Invalid host");
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'",
    );
    if (url.pathname === "/api/health") {
      lastPing = Date.now();
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ app: "TarkovOffline", version: 1 }));
    }
    if (url.pathname === "/api/profile") {
      const file = path.join(userRoot, "profile.json");
      if (req.method === "GET") {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        return res.end(fs.existsSync(file) ? fs.readFileSync(file) : "null");
      }
      if (req.method === "PUT") {
        if (req.headers.origin !== `http://${req.headers.host}`) {
          res.writeHead(403);
          return res.end("Invalid origin");
        }
        let chunks = [],
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8 * 1024 * 1024) {
            res.writeHead(413);
            res.end();
            req.destroy();
            return;
          }
          chunks.push(chunk);
        }
        const p = JSON.parse(Buffer.concat(chunks));
        if (!validProfile(p)) {
          res.writeHead(400);
          return res.end("Invalid profile");
        }
        fs.mkdirSync(userRoot, { recursive: true });
        if (fs.existsSync(file)) fs.copyFileSync(file, file + ".bak");
        fs.writeFileSync(file + ".tmp", JSON.stringify(p, null, 2));
        fs.renameSync(file + ".tmp", file);
        res.writeHead(204);
        return res.end();
      }
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    const p = safePath(
      publicRoot,
      decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!p || !fs.existsSync(p) || !fs.statSync(p).isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.setHeader(
      "Content-Type",
      types[path.extname(p)] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Length", fs.statSync(p).size);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    res.writeHead(500);
    res.end("Local request failed");
  }
});
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  server.listen(port, "127.0.0.1", () =>
    console.log(`Tarkov Offline: http://127.0.0.1:${port}`),
  );
  server.on("error", (e) => {
    console.error(e.message);
    process.exit(1);
  });
  if (process.argv.includes("--desktop"))
    setInterval(() => {
      if (Date.now() - lastPing > 120000) server.close(() => process.exit(0));
    }, 30000).unref();
}
