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
    criticality    TEXT     DEFAULT 'medium'
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
  db.exec("ALTER TABLE devices ADD COLUMN criticality TEXT DEFAULT 'medium'")

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
