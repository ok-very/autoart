import { Kysely, Migrator, FileMigrationProvider, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (two levels up from src/db/)
const envPath = path.join(__dirname, '..', '..', '..', '.env');
dotenv.config({ path: envPath });

async function migrate() {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  });

  const migrationFolder = path.join(__dirname, 'migrations');

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path: {
        join: (...args: string[]) => pathToFileURL(path.join(...args)).href,
      },
      migrationFolder,
    }),
  });

  const direction = process.argv[2];

  let result;
  if (direction === 'down') {
    result = await migrator.migrateDown();
  } else {
    result = await migrator.migrateToLatest();
  }

  const { error, results } = result;

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('Failed to migrate');
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
  process.exit(0);
}

migrate();
