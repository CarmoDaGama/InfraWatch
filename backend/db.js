import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath =
  process.env.NODE_ENV === 'test'
    ? ':memory:'
    : path.join(__dirname, 'infrawatch.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    url        TEXT    NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    enabled    INTEGER  DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id     INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    status        TEXT    NOT NULL,
    response_time REAL,
    checked_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed admin user on startup if credentials are provided and user doesn't exist yet.
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (!exists) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(ADMIN_EMAIL, hash);
    console.log(`Admin user seeded: ${ADMIN_EMAIL}`);
  }
}

export default db;
