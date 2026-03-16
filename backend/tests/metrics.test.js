import request from 'supertest';
import express from 'express';
import metricsRouter from '../routes/metrics.js';
import { cleanupTestDbs, createTestDb } from './testDb.js';

async function buildApp(role = 'viewer') {
  const db = await createTestDb();
  const device = await db.device.create({
    data: { name: 'Test Device', url: 'http://example.com' },
  });
  await db.metric.create({
    data: { deviceId: device.id, status: 'up', responseTime: 120 },
  });
  await db.metric.create({
    data: { deviceId: device.id, status: 'down', responseTime: null },
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (role) {
      req.user = { id: 1, email: 'viewer@example.com', role };
    }
    next();
  });
  app.use('/api/metrics', metricsRouter(db));
  return { app, db, deviceId: device.id };
}

describe('Metrics API', () => {
  afterEach(async () => {
    await cleanupTestDbs();
  });

  test('GET /api/metrics returns 200', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/metrics?device_id=X filters by device', async () => {
    const { app, deviceId } = await buildApp();
    const res = await request(app).get(`/api/metrics?device_id=${deviceId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((m) => expect(m.device_id).toBe(deviceId));
  });

  test('GET /api/metrics/uptime returns 200', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/api/metrics/uptime');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('uptime_pct');
  });

  test('GET /api/metrics returns 401 without authenticated role', async () => {
    const { app } = await buildApp(null);
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(401);
  });
});
