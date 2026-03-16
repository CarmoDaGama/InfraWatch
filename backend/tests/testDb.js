import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createDbClient, ensureDbReady, disconnectDb } from '../db.js';

async function applyMigrations(db) {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const migrationDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationDirectory of migrationDirectories) {
    const migrationSqlPath = path.join(migrationsDir, migrationDirectory, 'migration.sql');
    const migrationSql = await fs.readFile(migrationSqlPath, 'utf8');
    const statements = migrationSql
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      await db.$executeRawUnsafe(statement);
    }
  }
}

const openDatabases = [];

export async function createTestDb() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'infrawatch-prisma-'));
  const databaseUrl = `file:${path.join(directory, 'test.db')}`;
  const db = createDbClient(databaseUrl);

  await db.$connect();
  await applyMigrations(db);
  await ensureDbReady(db);
  openDatabases.push({ db, directory });

  return db;
}

export async function cleanupTestDbs() {
  while (openDatabases.length > 0) {
    const { db, directory } = openDatabases.pop();

    try {
      await disconnectDb(db);
    } catch {
      // ignore disconnect errors during test teardown
    }

    try {
      await fs.rm(directory, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup errors during test teardown
    }
  }
}