/**
 * Database Nuke Script
 *
 * Completely drops and recreates the database schema.
 * Use this when you want a fresh start.
 *
 * Usage: npm run db:nuke
 *
 * WARNING: This destroys ALL data!
 */

import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '..', '..', '.env');
dotenv.config({ path: envPath });

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function nuke() {
  console.log('\n========================================');
  console.log('  DATABASE NUKE');
  console.log('========================================\n');

  console.log('This will DESTROY ALL DATA and reset the database.\n');

  // Check for --force flag
  const force = process.argv.includes('--force');

  if (!force) {
    const confirm = await prompt('Type "nuke" to confirm: ');
    if (confirm !== 'nuke') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  });

  try {
    console.log('\nDropping all tables...');
    await sql`DROP SCHEMA public CASCADE`.execute(db);
    await sql`CREATE SCHEMA public`.execute(db);
    await sql`GRANT ALL ON SCHEMA public TO public`.execute(db);

    console.log('Database nuked successfully.');
    console.log('\nNext: Run "npm run migrate && npm run seed:dev"\n');

  } catch (err) {
    console.error('Error during nuke:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

nuke();
