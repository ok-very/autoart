import { Kysely } from 'kysely';

/**
 * Migration: Rename radix_tree to blocks_config in intake_form_pages
 *
 * This migration updates the column name to reflect the new block-based
 * storage format (FormBlock[]) instead of generic RadixElement trees.
 *
 * Since we're starting fresh (no existing form data to migrate),
 * this is a simple column rename.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('intake_form_pages')
    .renameColumn('radix_tree', 'blocks_config')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('intake_form_pages')
    .renameColumn('blocks_config', 'radix_tree')
    .execute();
}
