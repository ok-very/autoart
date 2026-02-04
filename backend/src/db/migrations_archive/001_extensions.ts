/**
 * Migration 001: PostgreSQL Extensions
 *
 * This migration enables required PostgreSQL extensions.
 * Extensions must be enabled before they can be used in subsequent migrations.
 *
 * Required extensions:
 * - pgcrypto: For gen_random_uuid() function (UUID generation)
 *
 * Note for Azure PostgreSQL:
 * Extensions must be allowlisted in Azure Portal under Server Parameters → azure.extensions
 * before they can be created via SQL. If running on Azure, ensure 'PGCRYPTO' is in that list.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  try {
    // Enable pgcrypto for UUID generation (gen_random_uuid)
    // This is idempotent - safe to run multiple times
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);
    console.log('✅ pgcrypto extension enabled');
  } catch (error) {
    const message = (error as Error).message || '';

    // Check if extension already exists or is already available
    if (message.includes('already exists') || message.includes('already loaded')) {
      console.log('✅ pgcrypto extension already exists');
      return;
    }

    // Azure-specific error: extension not allowlisted
    if (message.includes('check_extension_permissions') || message.includes('azure')) {
      console.error(`
❌ Azure PostgreSQL: pgcrypto extension not enabled.

To fix this:
1. Go to Azure Portal → Your PostgreSQL Flexible Server
2. Navigate to Server parameters
3. Search for "azure.extensions"
4. Add "PGCRYPTO" to the list (comma-separated if others exist)
5. Click Save and wait for it to apply
6. Re-run this migration

For more info: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-extensions
`);
      throw new Error('Azure PostgreSQL: pgcrypto extension must be enabled in Azure Portal first');
    }

    throw error;
  }
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // Note: We don't drop extensions on rollback as other schemas may depend on them
  // If you need to drop: await sql`DROP EXTENSION IF EXISTS "pgcrypto"`.execute(db);
}
