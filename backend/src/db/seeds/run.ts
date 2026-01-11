/**
 * Seed Runner
 *
 * Usage:
 *   npm run seed          - Run reference data seeds only
 *   npm run seed:dev      - Run reference + development sample data
 *   npm run seed:reset    - Clear all data and re-seed with dev data
 */

import dotenv from 'dotenv';
import { Kysely, PostgresDialect } from 'kysely';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

import type { Database } from '../schema.js';
import { seed as seedRecordDefinitions } from './001_record_definitions.js';
import { seedDevData } from './dev_sample_data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (three levels up from src/db/seeds/)
const envPath = path.join(__dirname, '..', '..', '..', '..', '.env');
dotenv.config({ path: envPath });

async function main() {
  const args = process.argv.slice(2);
  const includeDevData = args.includes('--dev') || args.includes('-d');
  const resetFirst = args.includes('--reset') || args.includes('-r');

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  });

  console.log('');
  console.log('========================================');
  console.log('       AutoArt Database Seeder');
  console.log('========================================');
  console.log('');

  try {
    if (resetFirst) {
      console.log('[!] Resetting database data...');
      // Delete in reverse dependency order
      await db.deleteFrom('task_references').execute();
      await db.deleteFrom('records').execute();
      await db.deleteFrom('hierarchy_nodes').execute();
      await db.deleteFrom('record_definitions').execute();
      await db.deleteFrom('sessions').execute();
      await db.deleteFrom('users').execute();
      console.log('  [OK] All data cleared');
      console.log('');
    }

    // Always run reference data
    console.log('[1] Seeding reference data...');
    await seedRecordDefinitions(db);
    console.log('');

    // Optionally run dev data
    if (includeDevData) {
      console.log('[2] Seeding development sample data...');
      await seedDevData(db);
      console.log('');
    }

    console.log('========================================');
    console.log('  Seeding complete!');
    if (includeDevData) {
      console.log('');
      console.log('  Demo login:');
      console.log('    Email:    demo@autoart.local');
      console.log('    Password: demo123');
    }
    console.log('========================================');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('[X] Seed failed:', error);
    process.exit(1);
  }

  await db.destroy();
  process.exit(0);
}

main();
