import request from 'supertest';
import express from 'express';
import usersRouter from '../routes/users.js';
import { cleanupTestDbs, createTestDb } from './testDb.js';

async function buildApp(role = 'admin') {
  const db = await createTestDb();
  await db.user.create({
    data: { email: 'admin@infrawatch.local', role: 'admin', passwordHash: 'hash1' },
  });
  await db.user.create({
    data: { email: 'viewer@infrawatch.local', role: 'viewer', passwordHash: 'hash2' },
  });

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
  afterEach(async () => {
    await cleanupTestDbs();
  });

  test('GET /api/users returns users for admin', async () => {
    const { app } = await buildApp('admin');
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toHaveProperty('email');
  });

  test('GET /api/users returns 403 for non-admin', async () => {
    const { app } = await buildApp('viewer');
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(403);
  });

  test('PATCH /api/users/:id/role updates role for admin', async () => {
    const { app, db } = await buildApp('admin');
    const viewer = await db.user.findUnique({
      where: { email: 'viewer@infrawatch.local' },
      select: { id: true },
    });

    const res = await request(app)
      .patch(`/api/users/${viewer.id}/role`)
      .send({ role: 'operator' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('operator');
  });

  test('PATCH /api/users/:id/role blocks demotion of last admin', async () => {
    const { app, db } = await buildApp('admin');
    const admin = await db.user.findUnique({
      where: { email: 'admin@infrawatch.local' },
      select: { id: true },
    });

    const res = await request(app)
      .patch(`/api/users/${admin.id}/role`)
      .send({ role: 'viewer' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last admin/i);
  });
});