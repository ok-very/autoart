import { Kysely, sql } from 'kysely';

/**
 * Migration: Ensure unique constraint on intake_form_pages (form_id, page_index)
 *
 * This constraint is required for the upsert operation in intake.service.ts.
 * Using IF NOT EXISTS makes this idempotent if the index already exists.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_form_pages_form_page
    ON intake_form_pages (form_id, page_index)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS idx_intake_form_pages_form_page
  `.execute(db);
}
