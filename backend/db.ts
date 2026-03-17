import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import { normalizeRole } from './middleware/rbac.js';

function getDefaultDatabaseUrl() {
  return `file:${path.join(process.cwd(), 'data', 'infrawatch.db')}`;
}

function resolveDatabaseUrl(databaseUrl?: string) {
  return databaseUrl?.trim() || process.env.DATABASE_URL?.trim() || getDefaultDatabaseUrl();
}

export function createDbClient(databaseUrl?: string) {
  const resolvedUrl = resolveDatabaseUrl(databaseUrl);
  const client = new PrismaClient({
    datasources: {
      db: {
        url: resolvedUrl,
      },
    },
  });
  (client as any).__resolvedUrl = resolvedUrl;
  return client;
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getDefaultDatabaseUrl();
}

const db = createDbClient();

async function seedAdminUser(client: PrismaClient) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_ROLE } = process.env;
  const seedRole = normalizeRole(ADMIN_ROLE) ?? 'admin';

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return;
  }

  const existingUser = await client.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, role: true },
  });

  if (!existingUser) {
    const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    await client.user.create({
      data: {
        email: ADMIN_EMAIL,
        role: seedRole,
        passwordHash,
      },
    });
    console.log(`Admin user seeded: ${ADMIN_EMAIL} (${seedRole})`);
    return;
  }

  if ((normalizeRole(existingUser.role) ?? 'viewer') !== seedRole) {
    await client.user.update({
      where: { id: existingUser.id },
      data: { role: seedRole },
    });
    console.log(`Admin role updated: ${ADMIN_EMAIL} (${seedRole})`);
  }
}

async function initializeDatabase(client: PrismaClient) {
  await client.$connect();
  const url = (client as any).__resolvedUrl as string | undefined;
  if (url?.startsWith('file:')) {
    await client.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  }
  await seedAdminUser(client);
}

let defaultDbReadyPromise: Promise<void> | null = null;

export function ensureDbReady(client: PrismaClient = db) {
  if (client !== db) {
    return initializeDatabase(client);
  }

  if (!defaultDbReadyPromise) {
    defaultDbReadyPromise = initializeDatabase(db);
  }

  return defaultDbReadyPromise;
}

export async function disconnectDb(client: PrismaClient = db) {
  await client.$disconnect();
}

export default db;
