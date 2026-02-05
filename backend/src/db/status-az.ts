/**
 * Azure-aware Database Status Script
 *
 * Same as status.ts but uses Entra ID when AZURE_AD_USER is set.
 *
 * Usage: npm run db:status:az
 */

import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { Kysely, PostgresDialect, sql } from 'kysely';
import path from 'path';
import { fileURLToPath } from 'url';

import { createScriptPool } from './create-pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '..', '..', '.env');
dotenv.config({ path: envPath });

async function status() {
  console.log('\n========================================');
  console.log('  DATABASE STATUS (Azure)');
  console.log('========================================\n');

  const pool = await createScriptPool();
  const db = new Kysely<any>({
    dialect: new PostgresDialect({ pool }),
  });

  try {
    const migrationFolder = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationFolder);
    const diskMigrations = files
      .filter(f => f.endsWith('.ts'))
      .map(f => path.basename(f, '.ts'))
      .sort();

    console.log(`Migrations on disk: ${diskMigrations.length}`);

    let dbMigrations: string[] = [];
    try {
      const result = await db
        .selectFrom('kysely_migration')
        .select('name')
        .orderBy('name')
        .execute();
      dbMigrations = result.map(m => m.name);
      console.log(`Migrations executed: ${dbMigrations.length}`);
    } catch {
      console.log('Migrations executed: 0 (table not found)');
    }

    const pending = diskMigrations.filter(m => !dbMigrations.includes(m));
    const orphaned = dbMigrations.filter(m => !diskMigrations.includes(m));

    if (pending.length > 0) {
      console.log(`\nPending migrations (${pending.length}):`);
      pending.forEach(m => console.log(`  + ${m}`));
    }

    if (orphaned.length > 0) {
      console.log(`\nOrphaned migrations (${orphaned.length}):`);
      orphaned.forEach(m => console.log(`  ! ${m} (in DB but not on disk)`));
      console.log('\n  Run "npm run db:repair" to clean up orphaned migrations.');
    }

    console.log('\n--- Table Statistics ---');

    const tables = [
      'users',
      'sessions',
      'record_definitions',
      'hierarchy_nodes',
      'records',
      'record_links',
    ];

    for (const table of tables) {
      try {
        const result = await sql<{ count: string }>`
          SELECT COUNT(*) as count FROM ${sql.table(table)}
        `.execute(db);
        const count = result.rows[0]?.count || '0';
        console.log(`  ${table}: ${count} rows`);
      } catch {
        console.log(`  ${table}: (not found)`);
      }
    }

    console.log('\n--- System Definitions ---');
    try {
      const defs = await db
        .selectFrom('record_definitions')
        .select(['name', 'is_system'])
        .where('name', 'in', ['Task', 'Subtask'])
        .execute();

      if (defs.length === 0) {
        console.log('  Task: MISSING');
        console.log('  Subtask: MISSING');
        console.log('\n  Run "npm run db:reset" to recreate system definitions.');
      } else {
        for (const def of defs) {
          console.log(`  ${def.name}: OK (is_system=${def.is_system})`);
        }
      }
    } catch {
      console.log('  (record_definitions table not found)');
    }

    console.log('');

  } catch (err) {
    console.error('Error checking status:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

status();
