#!/usr/bin/env node
/**
 * Migrate data from SQLite to PostgreSQL
 * 
 * Usage:
 *   npm run db:migrate-sqlite-to-pg
 * 
 * Prerequisites:
 *   - SQLite backup in data/infrawatch.db.backup
 *   - PostgreSQL running and empty
 *   - DATABASE_URL pointing to PostgreSQL
 *   - npm install sqlite3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

// Note: Run 'npm install sqlite3' to use this script
// For now, this is a template to guide manual migration

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.join(__dirname, '../POSTGRESQL_MIGRATION.md');

console.log(`
╔════════════════════════════════════════════════════════════════╗
║         SQLite → PostgreSQL Migration Guide                    ║
╚════════════════════════════════════════════════════════════════╝

This script helps migrate from SQLite to PostgreSQL with TimescaleDB.

📖 Full documentation available in:
   ${docPath}

Quick Start:
   1. Backup current database:
      $ cp data/infrawatch.db data/infrawatch.db.backup

   2. Set up PostgreSQL with TimescaleDB:
      $ docker run --name infrawatch-pg \
          -e POSTGRES_DB=infrawatch \
          -e POSTGRES_USER=infrawatch \
          -e POSTGRES_PASSWORD=infrawatch \
          -p 5432:5432 \
          -d timescale/timescaledb:latest-pg15

   3. Update .env file:
      DATABASE_URL="postgresql://infrawatch:infrawatch@localhost:5432/infrawatch"

   4. Generate Prisma migrations:
      $ npx prisma migrate dev --name initial

   5. Install sqlite3 for data import:
      $ npm install sqlite3

   6. Run automated migration (requires sqlite3):
      $ npm run db:migrate-sqlite-to-pg

   7. Optional: Set up TimescaleDB optimizations:
      $ npm run db:setup-timescale

📚 For detailed steps, see: POSTGRESQL_MIGRATION.md

Note: If you prefer manual migration, you can export data as SQL
and import using standard PostgreSQL tools.
`);

// Write helper script for manual export
const helperScript = `
-- Export SQLite data to CSV for manual import
.mode csv
.output devices.csv
SELECT * FROM devices;
.output metrics.csv
SELECT * FROM metrics;
.output users.csv
SELECT * FROM users;

-- Then import into PostgreSQL:
COPY devices FROM 'devices.csv' WITH (FORMAT csv, HEADER true);
COPY metrics FROM 'metrics.csv' WITH (FORMAT csv, HEADER true);
COPY users FROM 'users.csv' WITH (FORMAT csv, HEADER true);
`;

const helperPath = path.join(__dirname, '../scripts/manual-export.sql');
fs.writeFileSync(helperPath, helperScript);
console.log(`\n📄 Helper script created: scripts/manual-export.sql`);
