/**
 * Database Client
 *
 * Supports two connection modes:
 * - Development: Password-based connection using DATABASE_URL
 * - Production: Entra ID (Azure AD) token-based authentication
 *
 * In production, tokens are acquired via DefaultAzureCredential
 * and refreshed automatically before expiration.
 */

import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { Database } from './schema.js';
import { env } from '../config/env.js';

let pool: Pool;
let tokenExpiresAt: number | null = null;

/**
 * Create database pool with appropriate authentication
 */
async function createPool(): Promise<Pool> {
  const isDev = env.NODE_ENV === 'development';

  if (isDev || !env.AZURE_AD_USER) {
    // Development: Use password-based connection string
    console.log('🔌 Using password-based database connection');
    return new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_SIZE,
      ssl: env.DATABASE_URL.includes('azure') ? { rejectUnauthorized: false } : undefined,
    });
  }

  // Production: Use Entra ID token-based authentication
  console.log('🔐 Using Entra ID token-based database connection');

  // Dynamic import to avoid loading Azure SDK in dev
  const { DefaultAzureCredential } = await import('@azure/identity');
  const credential = new DefaultAzureCredential();

  const tokenResponse = await credential.getToken('https://ossrdbms-aad.database.windows.net');
  if (!tokenResponse) {
    throw new Error('Failed to acquire Azure AD token for database');
  }

  // Track token expiration for refresh
  tokenExpiresAt = tokenResponse.expiresOnTimestamp;

  // Extract host from DATABASE_URL or use default
  const dbHost = 'autoart.postgres.database.azure.com';

  return new Pool({
    host: dbHost,
    database: 'postgres',
    port: 5432,
    user: env.AZURE_AD_USER,
    password: tokenResponse.token,
    ssl: { rejectUnauthorized: false },
    max: env.DATABASE_POOL_SIZE,
  });
}

/**
 * Refresh token if needed (called before queries in production)
 */
async function ensureFreshToken(): Promise<void> {
  if (!tokenExpiresAt || env.NODE_ENV === 'development' || !env.AZURE_AD_USER) {
    return;
  }

  // Refresh if token expires in less than 5 minutes
  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() > tokenExpiresAt - fiveMinutes) {
    console.log('🔄 Refreshing Azure AD token...');
    const newPool = await createPool();
    await pool.end();
    pool = newPool;
  }
}

/**
 * Initialize the database pool
 */
async function initPool(): Promise<Pool> {
  if (!pool) {
    pool = await createPool();
  }
  return pool;
}

// Initialize pool synchronously for backwards compatibility
// In production with Entra ID, first query will trigger async initialization
pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_SIZE,
  ssl: env.DATABASE_URL?.includes('azure') ? { rejectUnauthorized: false } : undefined,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

/**
 * Check database connection
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await ensureFreshToken();
    await db.selectFrom('users').select('id').limit(1).execute();
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

/**
 * Initialize database with Entra ID support
 * Call this at app startup in production
 */
export async function initializeDatabase(): Promise<void> {
  if (env.NODE_ENV !== 'development' && env.AZURE_AD_USER) {
    const newPool = await initPool();
    // Replace the synchronously created pool with the async one
    // This is a workaround for Kysely requiring a pool at construction time
    (db as any).executor.adapter.pool = newPool;
    pool = newPool;
  }
}
