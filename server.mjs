import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GpsService } from "./server/gps.mjs";
import { spawn } from "node:child_process";
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
const gps = new GpsService(root);
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
      return res.end(
        JSON.stringify({ app: "TarkovOffline", version: 2, gps: true }),
      );
    }
    if (url.pathname.startsWith("/api/gps/")) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      if (url.pathname === "/api/gps/state" && req.method === "GET")
        return res.end(JSON.stringify(gps.state()));
      if (req.method !== "POST" && req.method !== "PUT") {
        res.writeHead(405);
        return res.end("{}");
      }
      if (req.headers.origin !== `http://${req.headers.host}`) {
        res.writeHead(403);
        return res.end("{}");
      }
      let body = "",
        bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 16384) {
          res.writeHead(413);
          res.end("{}");
          req.destroy();
          return;
        }
        body += chunk.toString("utf8");
      }
      try {
        const value = body ? JSON.parse(body) : {};
        if (url.pathname === "/api/gps/settings")
          return res.end(JSON.stringify(gps.settings(value)));
        if (url.pathname === "/api/gps/auto") {
          if (typeof value.enabled !== "boolean")
            throw Error("Укажите включение или выключение автосъёмки");
          if (value.enabled) gps.startAuto(value.manualRaid === true);
          else gps.stopAuto();
          return res.end(JSON.stringify(gps.state()));
        }
        if (url.pathname === "/api/gps/pick-folder") {
          const child = spawn(
            path.join(root, "runtime/GpsCapture.exe"),
            ["--pick-folder"],
            { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
          );
          let selected = "";
          child.stdout.setEncoding("utf8");
          child.stdout.on("data", (s) => {
            if (selected.length < 8192) selected += s;
          });
          child.on("error", () => {
            if (!res.writableEnded) {
              res.writeHead(500);
              res.end(
                JSON.stringify({ error: "Не удалось открыть выбор папки" }),
              );
            }
          });
          child.on("close", () => {
            if (!res.writableEnded)
              res.end(JSON.stringify({ path: selected.trim() }));
          });
          return;
        }
        res.writeHead(404);
        return res.end("{}");
      } catch (e) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: e.message }));
      }
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
  gps.start();
  process.on("exit", () => gps.stop());
  process.on("SIGINT", () => {
    gps.stop();
    server.close(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    gps.stop();
    server.close(() => process.exit(0));
  });
  server.on("error", (e) => {
    console.error(e.message);
    process.exit(1);
  });
  if (process.argv.includes("--desktop"))
    setInterval(() => {
      if (Date.now() - lastPing > 120000) server.close(() => process.exit(0));
    }, 30000).unref();
}
