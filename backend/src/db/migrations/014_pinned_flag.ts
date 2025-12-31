/**
 * Migration 014: Pinned Flag for Record Definitions
 *
 * Adds a `pinned` boolean flag to record_definitions.
 * - pinned: When true, definition appears in quick create menu in hierarchy sidebar
 *
 * Defaults to false (not pinned).
 */

import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add pinned flag - defaults to false
  await db.schema
    .alterTable('record_definitions')
    .addColumn('pinned', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('record_definitions')
    .dropColumn('pinned')
    .execute();
}
