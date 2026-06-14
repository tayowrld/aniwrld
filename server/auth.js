import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db.js";

const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  db.prepare("INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)").run(tokenHash(token), userId, expires.toISOString());
  return { token, expires };
}

export function deleteSession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE id_hash = ?").run(tokenHash(token));
}

export function readUser(token) {
  if (!token) return null;
  db.prepare("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP").run();
  return db.prepare(`
    SELECT users.id, users.username, users.role, users.created_at AS createdAt
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP
  `).get(tokenHash(token)) || null;
}

export function cookieToken(request) {
  const cookies = Object.fromEntries((request.headers.cookie || "").split(";").map((part) => part.trim().split("=")));
  return cookies.aniwrld_session;
}

export function sessionCookie(token, expires) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `aniwrld_session=${token}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires.toUTCString()}${secure}`;
}

export function expiredCookie() {
  return "aniwrld_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
}
