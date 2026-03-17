import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { createDbClient, ensureDbReady, disconnectDb } from '../db.js';

// Base PostgreSQL URL without a specific database
function getBaseUrl() {
  const url = process.env.DATABASE_URL || 'postgresql://infrawatch:infrawatch@localhost:5433/infrawatch?schema=public';
  // Strip the database name so we can connect to 'postgres' admin db
  return url.replace(/\/[^/?]+(\?|$)/, '/postgres$1');
}

function getTestDbUrl(dbName) {
  const url = process.env.DATABASE_URL || 'postgresql://infrawatch:infrawatch@localhost:5433/infrawatch?schema=public';
  return url.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
}

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
  const dbName = `iw_test_${crypto.randomUUID().replace(/-/g, '')}`;

  // Create the test database using the admin postgres db
  const adminClient = new PrismaClient({ datasources: { db: { url: getBaseUrl() } } });
  await adminClient.$connect();
  await adminClient.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await adminClient.$disconnect();

  const databaseUrl = getTestDbUrl(dbName);
  const db = createDbClient(databaseUrl);

  await db.$connect();
  await applyMigrations(db);
  await ensureDbReady(db);
  openDatabases.push({ db, dbName });

  return db;
}

export async function cleanupTestDbs() {
  const toCleanup = openDatabases.splice(0);

  for (const { db, dbName } of toCleanup) {
    try {
      await disconnectDb(db);
    } catch {
      // ignore disconnect errors during test teardown
    }

    try {
      const adminClient = new PrismaClient({ datasources: { db: { url: getBaseUrl() } } });
      await adminClient.$connect();
      await adminClient.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
      await adminClient.$disconnect();
    } catch {
      // ignore cleanup errors
    }
  }
}