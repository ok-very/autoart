/**
 * Migration 012: Clone Excluded Flag
 *
 * Changes the cloning model from opt-in (templates) to opt-out (exclusions).
 * - clone_excluded: When true, definition will NOT be cloned when cloning a project
 *
 * All definitions are now cloned by default unless explicitly excluded.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add clone_excluded flag - defaults to false (included in clones)
  await db.schema
    .alterTable('record_definitions')
    .addColumn('clone_excluded', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  // Index for efficient exclusion lookups
  await db.schema
    .createIndex('idx_definition_clone_excluded')
    .on('record_definitions')
    .column('clone_excluded')
    .where(sql.ref('clone_excluded'), '=', true)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('idx_definition_clone_excluded')
    .ifExists()
    .execute();

  await db.schema
    .alterTable('record_definitions')
    .dropColumn('clone_excluded')
    .execute();
}
