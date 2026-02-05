/**
 * Azure-aware Database Nuke Script
 *
 * Same as nuke.ts but uses Entra ID when AZURE_AD_USER is set.
 *
 * Usage: npm run db:nuke:az
 */

import dotenv from 'dotenv';
import { Kysely, PostgresDialect, sql } from 'kysely';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import { createScriptPool } from './create-pool.js';

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
  console.log('  DATABASE NUKE (Azure)');
  console.log('========================================\n');

  console.log('This will DESTROY ALL DATA and reset the database.\n');

  const force = process.argv.includes('--force');

  if (!force) {
    const confirm = await prompt('Type "nuke" to confirm: ');
    if (confirm !== 'nuke') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const pool = await createScriptPool();
  const db = new Kysely<any>({
    dialect: new PostgresDialect({ pool }),
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
