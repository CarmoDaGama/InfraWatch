import request from 'supertest';
import Database from 'better-sqlite3';
import express from 'express';
import usersRouter from '../routes/users.js';

const openDbs = [];

function buildApp(role = 'admin') {
  const db = new Database(':memory:');
  openDbs.push(db);
  db.exec(`
    CREATE TABLE users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      role          TEXT    NOT NULL DEFAULT 'viewer',
      password_hash TEXT    NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.prepare('INSERT INTO users (email, role, password_hash) VALUES (?, ?, ?)')
    .run('admin@infrawatch.local', 'admin', 'hash1');
  db.prepare('INSERT INTO users (email, role, password_hash) VALUES (?, ?, ?)')
    .run('viewer@infrawatch.local', 'viewer', 'hash2');

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = role ? { id: 1, email: 'session@infrawatch.local', role } : null;
    next();
  });
  app.use('/api/users', usersRouter(db));
  return { app, db };
}

describe('Users API (RBAC)', () => {
  afterEach(() => {
    while (openDbs.length > 0) {
      const db = openDbs.pop();
      try {
        db.close();
      } catch {
        // ignore close errors during test teardown
      }
    }
  });

  test('GET /api/users returns users for admin', async () => {
    const { app } = buildApp('admin');
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toHaveProperty('email');
  });

  test('GET /api/users returns 403 for non-admin', async () => {
    const { app } = buildApp('viewer');
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(403);
  });

  test('PATCH /api/users/:id/role updates role for admin', async () => {
    const { app, db } = buildApp('admin');
    const viewer = db.prepare('SELECT id FROM users WHERE email = ?').get('viewer@infrawatch.local');

    const res = await request(app)
      .patch(`/api/users/${viewer.id}/role`)
      .send({ role: 'operator' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('operator');
  });

  test('PATCH /api/users/:id/role blocks demotion of last admin', async () => {
    const { app, db } = buildApp('admin');
    const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@infrawatch.local');

    const res = await request(app)
      .patch(`/api/users/${admin.id}/role`)
      .send({ role: 'viewer' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last admin/i);
  });
});