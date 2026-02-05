import { Kysely, sql } from 'kysely';

/**
 * Migration 002: Fix intake_form_pages unique constraint
 *
 * The baseline migration (001) previously created two non-unique indexes
 * on intake_form_pages(form_id, page_index):
 *   - idx_intake_form_pages_form (duplicate, removed)
 *   - idx_intake_form_pages_form_page (non-unique, needs UNIQUE)
 *
 * The upsertPage() ON CONFLICT clause requires a unique constraint.
 * For fresh DBs, 001 now creates the index as unique.
 * This migration fixes existing DBs that ran the old baseline.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Drop the duplicate index if it exists
  await sql`DROP INDEX IF EXISTS idx_intake_form_pages_form`.execute(db);

  // Drop the non-unique index
  await sql`DROP INDEX IF EXISTS idx_intake_form_pages_form_page`.execute(db);

  // Recreate as unique
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_form_pages_form_page
    ON intake_form_pages (form_id, page_index)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_intake_form_pages_form_page`.execute(db);

  // Restore original non-unique indexes
  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_form_pages_form
    ON intake_form_pages (form_id, page_index)
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_form_pages_form_page
    ON intake_form_pages (form_id, page_index)
  `.execute(db);
}
