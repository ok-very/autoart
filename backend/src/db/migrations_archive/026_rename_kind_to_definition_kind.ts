/**
 * Migration 026: Rename kind to definition_kind
 *
 * Normalizes the column name for clarity:
 * - 'kind' → 'definition_kind'
 *
 * This makes it explicit that the column discriminates definition types,
 * not record types or other entities.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Rename column
    await sql`
    ALTER TABLE record_definitions
    RENAME COLUMN kind TO definition_kind
  `.execute(db);

    // Rename index
    await sql`
    ALTER INDEX idx_record_definitions_kind
    RENAME TO idx_record_definitions_definition_kind
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Revert index name
    await sql`
    ALTER INDEX idx_record_definitions_definition_kind
    RENAME TO idx_record_definitions_kind
  `.execute(db);

    // Revert column name
    await sql`
    ALTER TABLE record_definitions
    RENAME COLUMN definition_kind TO kind
  `.execute(db);
}
