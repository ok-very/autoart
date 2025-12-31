/**
 * Migration 001: PostgreSQL Extensions
 *
 * This migration enables required PostgreSQL extensions.
 * Extensions must be enabled before they can be used in subsequent migrations.
 *
 * Required extensions:
 * - pgcrypto: For gen_random_uuid() function (UUID generation)
 *
 * Note: Some extensions require superuser privileges. If running on managed
 * PostgreSQL (e.g., Supabase, Neon), these are usually pre-enabled.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Enable pgcrypto for UUID generation (gen_random_uuid)
  // This is idempotent - safe to run multiple times
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Note: We don't drop extensions on rollback as other schemas may depend on them
  // If you need to drop: await sql`DROP EXTENSION IF EXISTS "pgcrypto"`.execute(db);
}
