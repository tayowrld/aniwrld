import { createServer } from "node:http";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { db, getSetting, setSetting } from "./db.js";
import { cookieToken, createSession, deleteSession, expiredCookie, hashPassword, readUser, sessionCookie, verifyPassword } from "./auth.js";
import { configureMediaOwner, favorite, getLibrary, getResume, mediaState, playback, proxyAbsolute, proxyHls, proxyImage, proxyStream, report, rewritePlaylist, scan } from "./media.js";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const dist = resolve("dist");
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };

function json(response, status, body, headers = {}) {
  response.writeHead(status, { ...jsonHeaders, ...headers });
  response.end(JSON.stringify(body));
}

async function body(request) {
  let value = "";
  for await (const chunk of request) {
    value += chunk;
    if (value.length > 100_000) throw new Error("Слишком большой запрос.");
  }
  return value ? JSON.parse(value) : {};
}

function publicState() {
  const hasAdmin = Boolean(db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get());
  return { setupRequired: !hasAdmin, registrationEnabled: getSetting("registration_enabled") === "true", media: mediaState() };
}

function validateCredentials(username, password) {
  const clean = String(username || "").trim();
  if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(clean)) throw new Error("Имя: 3–32 символа, буквы, цифры, точка, дефис или подчёркивание.");
  if (String(password || "").length < 8) throw new Error("Пароль должен содержать минимум 8 символов.");
  return clean;
}

async function api(request, response, url) {
  const user = readUser(cookieToken(request));
  if (request.method === "GET" && url.pathname === "/api/auth/status") return json(response, 200, { ...publicState(), user });

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    try {
      const data = await body(request);
      const state = publicState();
      if (!state.setupRequired && !state.registrationEnabled) return json(response, 403, { error: "Регистрация отключена администратором." });
      const username = validateCredentials(data.username, data.password);
      const role = state.setupRequired ? "admin" : "user";
      const result = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(username, hashPassword(data.password), role);
      const created = db.prepare("SELECT id, username, role, created_at AS createdAt FROM users WHERE id = ?").get(result.lastInsertRowid);
      const session = createSession(created.id);
      return json(response, 201, { user: created }, { "Set-Cookie": sessionCookie(session.token, session.expires) });
    } catch (error) {
      return json(response, String(error.message).includes("UNIQUE") ? 409 : 400, { error: String(error.message).includes("UNIQUE") ? "Это имя уже занято." : error.message });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const data = await body(request);
    const found = db.prepare("SELECT id, username, role, password_hash FROM users WHERE username = ?").get(String(data.username || "").trim());
    if (!found || !verifyPassword(String(data.password || ""), found.password_hash)) return json(response, 401, { error: "Неверное имя пользователя или пароль." });
    const session = createSession(found.id);
    return json(response, 200, { user: { id: found.id, username: found.username, role: found.role } }, { "Set-Cookie": sessionCookie(session.token, session.expires) });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    deleteSession(cookieToken(request));
    return json(response, 200, { ok: true }, { "Set-Cookie": expiredCookie() });
  }

  if (!user) return json(response, 401, { error: "Требуется авторизация." });

  if (request.method === "GET" && url.pathname === "/api/settings") {
    return json(response, 200, { registrationEnabled: getSetting("registration_enabled") === "true", media: mediaState() });
  }
  if (request.method === "PATCH" && url.pathname === "/api/settings/registration") {
    if (user.role !== "admin") return json(response, 403, { error: "Требуются права администратора." });
    const data = await body(request);
    setSetting("registration_enabled", Boolean(data.enabled));
    return json(response, 200, { registrationEnabled: Boolean(data.enabled) });
  }
  if (request.method === "GET" && url.pathname === "/api/admin/users") {
    if (user.role !== "admin") return json(response, 403, { error: "Требуются права администратора." });
    return json(response, 200, { users: db.prepare("SELECT id, username, role, created_at AS createdAt FROM users ORDER BY id").all() });
  }
  if (request.method === "GET" && url.pathname === "/api/admin/directories") {
    if (user.role !== "admin") return json(response, 403, { error: "Требуются права администратора." });
    const path = resolve(url.searchParams.get("path") || homedir());
    if (!existsSync(path) || !statSync(path).isDirectory()) return json(response, 400, { error: "Папка недоступна." });
    const directories = readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => ({ name: entry.name, path: join(path, entry.name) })).sort((a, b) => a.name.localeCompare(b.name));
    return json(response, 200, { path, parent: dirname(path), directories });
  }
  if (request.method === "POST" && url.pathname === "/api/media/setup") {
    if (user.role !== "admin") return json(response, 403, { error: "Требуются права администратора." });
    const data = await body(request);
    return json(response, 200, { media: await configureMediaOwner(user.username, data.libraryPath) });
  }
  if (request.method === "GET" && url.pathname === "/api/media/status") return json(response, 200, mediaState());
  if (!mediaState().configured && url.pathname.startsWith("/api/media/")) return json(response, 409, { error: "Медиатека ещё не настроена." });
  if (request.method === "GET" && url.pathname === "/api/media/library") return json(response, 200, { items: await getLibrary() });
  if (request.method === "GET" && url.pathname === "/api/media/resume") return json(response, 200, { items: await getResume() });
  if (request.method === "POST" && url.pathname === "/api/media/favorite") {
    const data = await body(request); await favorite(data.id, data.value); return json(response, 200, { ok: true });
  }
  if (request.method === "POST" && url.pathname === "/api/media/scan") { await scan(); return json(response, 200, { ok: true }); }
  if (request.method === "POST" && url.pathname === "/api/media/playback") return json(response, 200, await playback(await body(request)));
  if (request.method === "POST" && url.pathname.startsWith("/api/media/report/")) {
    await report(url.pathname.split("/").pop(), await body(request)); return json(response, 200, { ok: true });
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/media/image/")) {
    const [, , , , id, type] = url.pathname.split("/");
    return pipeUpstream(response, await proxyImage(id, type, url.searchParams.get("width")));
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/media/stream/")) {
    return pipeUpstream(response, await proxyStream(url.pathname.split("/").pop(), url.searchParams.get("source")));
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/media/hls/")) {
    const upstream = await proxyHls(url.pathname.split("/").pop(), url.searchParams.toString());
    return playlist(response, upstream);
  }
  if (request.method === "GET" && url.pathname === "/api/media/proxy") {
    const upstream = await proxyAbsolute(url.searchParams.get("url") || "");
    return upstream.headers.get("content-type")?.includes("mpegurl") ? playlist(response, upstream) : pipeUpstream(response, upstream);
  }
  return json(response, 404, { error: "Маршрут не найден." });
}

async function playlist(response, upstream) {
  const text = rewritePlaylist(await upstream.text());
  response.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" });
  response.end(text);
}

function pipeUpstream(response, upstream) {
  const headers = {};
  for (const name of ["content-type", "content-length", "accept-ranges", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  response.writeHead(upstream.status, headers);
  if (!upstream.body) return response.end();
  return upstream.body.pipeTo(new WritableStream({ write(chunk) { response.write(chunk); }, close() { response.end(); } }));
}

function serveStatic(response, pathname) {
  const safePath = pathname.replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "");
  const requested = pathname === "/" ? join(dist, "index.html") : join(dist, safePath);
  const file = existsSync(requested) && statSync(requested).isFile() ? requested : join(dist, "index.html");
  if (!existsSync(file)) return json(response, 404, { error: "Сначала выполните npm run build." });
  response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(response);
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) return await api(request, response, url);
    return serveStatic(response, url.pathname);
  } catch (error) {
    return json(response, 500, { error: error.message || "Внутренняя ошибка." });
  }
}).listen(port, host, () => console.log(`AniWRLD server: http://${host}:${port}`));

setInterval(() => {
  if (mediaState().configured) scan().catch(() => {});
}, 15 * 60 * 1000).unref();
