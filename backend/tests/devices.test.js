import request from 'supertest';
import express from 'express';
import devicesRouter from '../routes/devices.js';
import { cleanupTestDbs, createTestDb } from './testDb.js';

async function buildApp(role = 'admin') {
  const db = await createTestDb();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 1, email: 'test@example.com', role };
    next();
  });
  app.use('/api/devices', devicesRouter(db));
  return { app, db };
}

describe('Devices API', () => {
  afterEach(async () => {
    await cleanupTestDbs();
  });

  test('GET /api/devices returns 200 with array', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/api/devices');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/devices creates a device with valid data', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'Test Device', url: 'http://example.com' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Device');
    expect(res.body.url).toBe('http://example.com');
    expect(res.body.id).toBeDefined();
    expect(res.body.check_interval_seconds).toBe(60);
  });

  test('POST /api/devices returns 400 with missing name', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({ url: 'http://example.com' });
    expect(res.status).toBe(400);
  });

  test('POST /api/devices returns 400 with missing url', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'Test Device' });
    expect(res.status).toBe(400);
  });

  test('DELETE /api/devices/:id deletes a device', async () => {
    const { app, db } = await buildApp();
    const device = await db.device.create({
      data: { name: 'Del Device', url: 'http://del.example.com' },
    });
    const id = device.id;

    const res = await request(app).delete(`/api/devices/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const found = await db.device.findUnique({ where: { id } });
    expect(found).toBeNull();
  });

  test('DELETE /api/devices/9999 returns 404', async () => {
    const { app } = await buildApp();
    const res = await request(app).delete('/api/devices/9999');
    expect(res.status).toBe(404);
  });

  // ── Type-aware tests ────────────────────────────────────────────────────────

  test('POST defaults type to http when type is omitted', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'Legacy', url: 'https://legacy.example.com' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('http');
  });

  test('POST creates a ping device', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'Router', url: '192.168.1.1', type: 'ping' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('ping');
    expect(res.body.url).toBe('192.168.1.1');
  });

  test('POST creates an snmp device with custom fields', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({
        name: 'Switch',
        url: '10.0.0.1',
        type: 'snmp',
        snmp_community: 'private',
        snmp_oid: '1.3.6.1.2.1.2.2.1.10.1',
        snmp_port: 1161,
        check_interval_seconds: 120,
      });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('snmp');
    expect(res.body.snmp_community).toBe('private');
    expect(res.body.snmp_port).toBe(1161);
    expect(res.body.check_interval_seconds).toBe(120);
  });

  test('POST returns 400 for invalid type', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'Bad', url: '192.168.1.1', type: 'ftp' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type must be one of/);
  });

  test('POST returns 400 when http device has non-http url', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'Bad HTTP', url: '192.168.1.1', type: 'http' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/http/);
  });

  test('POST returns 400 when snmp_port is out of range', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'BadPort', url: '10.0.0.1', type: 'snmp', snmp_port: 99999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/snmp_port/);
  });

  test('POST returns 400 when check_interval_seconds is outside allowed range', async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'TooFast', url: 'http://fast.example.com', check_interval_seconds: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/check_interval_seconds/);
  });

  test('PATCH /api/devices/:id updates check_interval_seconds', async () => {
    const { app } = await buildApp();
    const created = await request(app)
      .post('/api/devices')
      .send({ name: 'Patch Interval', url: 'http://patch.example.com' });

    const res = await request(app)
      .patch(`/api/devices/${created.body.id}`)
      .send({ check_interval_seconds: 300 });

    expect(res.status).toBe(200);
    expect(res.body.check_interval_seconds).toBe(300);
  });

  test('DELETE /api/devices/:id returns 403 for operator role', async () => {
    const { app, db } = await buildApp('operator');
    const device = await db.device.create({
      data: { name: 'No Delete', url: 'http://nodelete.example.com' },
    });

    const res = await request(app).delete(`/api/devices/${device.id}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/);
  });

  test('POST /api/devices returns 403 for viewer role', async () => {
    const { app } = await buildApp('viewer');
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'Read Only', url: 'http://readonly.example.com' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/);
  });
});
