/**
 * Migration 027: Add definition_id to actions
 *
 * Links actions to their recipe definition for stable lookups.
 * Previously, actions.type was a string that matched definition names,
 * which was fragile if names changed.
 *
 * This migration:
 * 1. Adds definition_id UUID column
 * 2. Backfills by matching actions.type to record_definitions.name
 * 3. Creates index for efficient lookups
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Add definition_id column (nullable for backward compatibility)
    await db.schema
        .alterTable('actions')
        .addColumn('definition_id', 'uuid', (col) =>
            col.references('record_definitions.id').onDelete('set null')
        )
        .execute();

    // Backfill definition_id by matching type to definition name
    // Only match definitions with definition_kind = 'action_recipe'
    await sql`
    UPDATE actions a
    SET definition_id = rd.id
    FROM record_definitions rd
    WHERE a.type = rd.name
      AND rd.definition_kind = 'action_recipe'
      AND a.definition_id IS NULL
  `.execute(db);

    // Create index for filtering by definition_id
    await db.schema
        .createIndex('idx_actions_definition_id')
        .on('actions')
        .column('definition_id')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .dropIndex('idx_actions_definition_id')
        .ifExists()
        .execute();

    await db.schema
        .alterTable('actions')
        .dropColumn('definition_id')
        .execute();
}
