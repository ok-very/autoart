/**
 * Shared pool factory for DB scripts.
 *
 * Usage:
 *   import { createScriptPool } from './create-pool.js';
 *   const pool = await createScriptPool();
 *
 * Reads AZURE_AD_USER and DATABASE_URL from process.env (caller must
 * have loaded dotenv already). When AZURE_AD_USER is set, uses Entra ID
 * token auth; otherwise falls back to DATABASE_URL password auth.
 */

import { Pool } from 'pg';

export async function createScriptPool(): Promise<Pool> {
  const azureAdUser = process.env.AZURE_AD_USER;

  if (azureAdUser) {
    const { DefaultAzureCredential } = await import('@azure/identity');
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken('https://ossrdbms-aad.database.windows.net');
    if (!tokenResponse) {
      throw new Error('Failed to acquire Azure AD token for database');
    }
    console.log('🔐 Using Entra ID token-based connection');
    return new Pool({
      host: 'autoart.postgres.database.azure.com',
      database: 'postgres',
      port: 5432,
      user: azureAdUser,
      password: tokenResponse.token,
      ssl: { rejectUnauthorized: false },
    });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required when AZURE_AD_USER is not set');
  }
  console.log('🔌 Using password-based connection');
  return new Pool({
    connectionString,
    ssl: connectionString.includes('azure') ? { rejectUnauthorized: false } : undefined,
  });
}
