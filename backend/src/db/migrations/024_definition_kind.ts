/**
 * Migration 024: Add Definition Kind Column
 *
 * Adds a `kind` discriminator to record_definitions:
 * - 'record' = data definitions (Contact, Location, Artwork, etc.)
 * - 'action_recipe' = action type definitions (Task, Subtask, Meeting, etc.)
 * - 'container' = container actions (Process, Stage, Subprocess)
 *
 * This separates:
 * - Records (data entities shown in Registry/Records view)
 * - Action Recipes (used in Composer for task-like work)
 * - Containers (hierarchical action containers)
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Add kind column with default 'record'
    await db.schema
        .alterTable('record_definitions')
        .addColumn('kind', 'text', (col) => col.notNull().defaultTo('record'))
        .execute();

    // Create index for filtering by kind
    await db.schema
        .createIndex('idx_record_definitions_kind')
        .on('record_definitions')
        .column('kind')
        .execute();

    // Promote Task and Subtask to action_recipe kind
    await sql`
        UPDATE record_definitions
        SET kind = 'action_recipe'
        WHERE name IN ('Task', 'Subtask')
    `.execute(db);

    // Promote Process, Stage, Subprocess to container kind
    await sql`
        UPDATE record_definitions
        SET kind = 'container'
        WHERE name IN ('Process', 'Stage', 'Subprocess')
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .dropIndex('idx_record_definitions_kind')
        .ifExists()
        .execute();

    await db.schema
        .alterTable('record_definitions')
        .dropColumn('kind')
        .execute();
}
