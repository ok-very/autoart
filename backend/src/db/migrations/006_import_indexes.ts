import { Kysely, sql } from 'kysely';

/**
 * Migration 006: Import Performance Indexes
 *
 * Adds indexes to accelerate common import session and plan queries:
 * - import_sessions ordered by created_at (session listing)
 * - import_plans by session_id + created_at (latest plan lookup)
 *
 * Vocabulary indexes already exist from migration 004.
 * Import action link indexes already exist from migration 005.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE INDEX idx_import_sessions_created_at ON import_sessions(created_at DESC)`.execute(db);
  await sql`CREATE INDEX idx_import_plans_session_id ON import_plans(session_id, created_at DESC)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_import_plans_session_id`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_import_sessions_created_at`.execute(db);
}
