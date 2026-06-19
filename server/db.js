import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";

const databasePath = resolve(process.env.ANIWRLD_DB_PATH || "data/aniwrld.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS metadata_cache (
    provider TEXT NOT NULL,
    lookup_key TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (provider, lookup_key)
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('registration_enabled', 'false');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('media_engine_url', 'http://127.0.0.1:8096');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('library_path', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('media_engine_token', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('media_engine_user_id', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('media_engine_username', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('media_engine_password', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('media_engine_status', 'not_configured');
`);

export function getSetting(key, fallback = null) {
  return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value ?? fallback;
}

export function setSetting(key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
}
