import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeRole } from './middleware/rbac.js';

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
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    url            TEXT    NOT NULL UNIQUE,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    enabled        INTEGER  DEFAULT 1,
    type           TEXT     NOT NULL DEFAULT 'http',
    snmp_community TEXT     DEFAULT 'public',
    snmp_oid       TEXT     DEFAULT '1.3.6.1.2.1.1.1.0',
    snmp_port      INTEGER  DEFAULT 161,
    sla_target     REAL     DEFAULT 99.0,
    criticality    TEXT     DEFAULT 'medium',
    check_interval_seconds INTEGER DEFAULT 60
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
    role          TEXT    NOT NULL DEFAULT 'viewer',
    password_hash TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Idempotent schema migrations for existing databases.
// ALTER TABLE fails if the column already exists, so we check PRAGMA table_info first.
function hasColumn(db, table, col) {
  return db.pragma(`table_info(${table})`).some((c) => c.name === col);
}
if (!hasColumn(db, 'devices', 'type'))
  db.exec("ALTER TABLE devices ADD COLUMN type TEXT NOT NULL DEFAULT 'http'");
if (!hasColumn(db, 'devices', 'snmp_community'))
  db.exec("ALTER TABLE devices ADD COLUMN snmp_community TEXT DEFAULT 'public'");
if (!hasColumn(db, 'devices', 'snmp_oid'))
  db.exec("ALTER TABLE devices ADD COLUMN snmp_oid TEXT DEFAULT '1.3.6.1.2.1.1.1.0'");
if (!hasColumn(db, 'devices', 'snmp_port'))
  db.exec('ALTER TABLE devices ADD COLUMN snmp_port INTEGER DEFAULT 161');
if (!hasColumn(db, 'devices', 'sla_target'))
  db.exec('ALTER TABLE devices ADD COLUMN sla_target REAL DEFAULT 99.0');
if (!hasColumn(db, 'devices', 'criticality'))
  db.exec("ALTER TABLE devices ADD COLUMN criticality TEXT DEFAULT 'medium'");
if (!hasColumn(db, 'devices', 'check_interval_seconds'))
  db.exec('ALTER TABLE devices ADD COLUMN check_interval_seconds INTEGER DEFAULT 60');
if (!hasColumn(db, 'users', 'role'))
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer'");

db.exec('UPDATE devices SET check_interval_seconds = 60 WHERE check_interval_seconds IS NULL OR check_interval_seconds < 1');
db.exec("UPDATE users SET role = 'viewer' WHERE role IS NULL OR trim(role) = ''");
db.exec("UPDATE users SET role = 'viewer' WHERE lower(role) NOT IN ('viewer', 'operator', 'admin')");

// Seed admin user on startup if credentials are provided and user doesn't exist yet.
const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_ROLE } = process.env;
const seedRole = normalizeRole(ADMIN_ROLE) ?? 'admin';
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const exists = db.prepare('SELECT id, role FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (!exists) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare('INSERT INTO users (email, role, password_hash) VALUES (?, ?, ?)').run(ADMIN_EMAIL, seedRole, hash);
    console.log(`Admin user seeded: ${ADMIN_EMAIL} (${seedRole})`);
  } else if (normalizeRole(exists.role) !== seedRole) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(seedRole, exists.id);
    console.log(`Admin role updated: ${ADMIN_EMAIL} (${seedRole})`);
  }
}

export default db;
