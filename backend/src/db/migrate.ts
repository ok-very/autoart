import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { Kysely, Migrator, FileMigrationProvider, PostgresDialect } from 'kysely';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (two levels up from src/db/)
const envPath = path.join(__dirname, '..', '..', '..', '.env');
dotenv.config({ path: envPath });

async function createPool(): Promise<Pool> {
  const connectionString = process.env.DATABASE_URL;
  const azureAdUser = process.env.AZURE_AD_USER;

  if (azureAdUser) {
    // Entra ID token auth — same approach as client.ts
    const { DefaultAzureCredential } = await import('@azure/identity');
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken('https://ossrdbms-aad.database.windows.net');
    if (!tokenResponse) {
      throw new Error('Failed to acquire Azure AD token for database');
    }
    return new Pool({
      host: 'autoart.postgres.database.azure.com',
      database: 'postgres',
      port: 5432,
      user: azureAdUser,
      password: tokenResponse.token,
      ssl: { rejectUnauthorized: false },
    });
  }

  // Password-based connection string
  return new Pool({
    connectionString,
    ssl: connectionString?.includes('azure') ? { rejectUnauthorized: false } : undefined,
  });
}

async function migrate() {
  const pool = await createPool();
  const db = new Kysely({
    dialect: new PostgresDialect({ pool }),
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
