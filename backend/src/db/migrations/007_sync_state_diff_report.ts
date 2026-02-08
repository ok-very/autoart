import { Kysely, sql } from 'kysely';

/**
 * Migration 007: Add last_diff_report to monday_sync_states
 *
 * Stores the most recent BFA sync diff report as JSONB on the
 * sync state row for its board config. Keeps diff reports colocated
 * with the sync state they describe.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE monday_sync_states ADD COLUMN last_diff_report jsonb`.execute(db);
  await sql`ALTER TABLE monday_sync_states ADD COLUMN last_diff_report_at timestamptz`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE monday_sync_states DROP COLUMN IF EXISTS last_diff_report_at`.execute(db);
  await sql`ALTER TABLE monday_sync_states DROP COLUMN IF EXISTS last_diff_report`.execute(db);
}
