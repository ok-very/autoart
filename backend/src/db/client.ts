import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import type { Database } from './schema.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_SIZE,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export async function checkConnection(): Promise<boolean> {
  try {
    await db.selectFrom('users').select('id').limit(1).execute();
    return true;
  } catch {
    return false;
  }
}
