/**
 * Migration: Add created_records column to intake_submissions
 *
 * Stores array of records created from RecordBlocks during form submission.
 * Format: [{ definitionId, recordId, uniqueName }, ...]
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('intake_submissions')
    .addColumn('created_records', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('intake_submissions')
    .dropColumn('created_records')
    .execute();
}
