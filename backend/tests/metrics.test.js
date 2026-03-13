import request from 'supertest';
import Database from 'better-sqlite3';
import express from 'express';
import metricsRouter from '../routes/metrics.js';

function buildApp() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE devices (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      url        TEXT    NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      enabled    INTEGER  DEFAULT 1
    );
    CREATE TABLE metrics (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id     INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      status        TEXT    NOT NULL,
      response_time REAL,
      checked_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const deviceResult = db
    .prepare('INSERT INTO devices (name, url) VALUES (?, ?)')
    .run('Test Device', 'http://example.com');
  const deviceId = deviceResult.lastInsertRowid;

  db.prepare(
    'INSERT INTO metrics (device_id, status, response_time) VALUES (?, ?, ?)'
  ).run(deviceId, 'up', 120);
  db.prepare(
    'INSERT INTO metrics (device_id, status, response_time) VALUES (?, ?, ?)'
  ).run(deviceId, 'down', null);

  const app = express();
  app.use(express.json());
  app.use('/api/metrics', metricsRouter(db));
  return { app, db, deviceId };
}

describe('Metrics API', () => {
  test('GET /api/metrics returns 200', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/metrics?device_id=X filters by device', async () => {
    const { app, deviceId } = buildApp();
    const res = await request(app).get(`/api/metrics?device_id=${deviceId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((m) => expect(m.device_id).toBe(deviceId));
  });

  test('GET /api/metrics/uptime returns 200', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/metrics/uptime');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('uptime_pct');
  });
});
