/**
 * Migration 037: Template Node Type
 *
 * Adds 'template' to the hierarchy_nodes type enum.
 * Templates are singleton records that:
 * - Float outside stage projections (hierarchy-agnostic)
 * - Deduplicate via external_source_mappings
 * - Can be linked to action instances
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // PostgreSQL doesn't support ALTER TYPE ADD VALUE in a transaction easily,
    // so we recreate the constraint. First drop the old check constraint.
    await sql`
        ALTER TABLE hierarchy_nodes 
        DROP CONSTRAINT IF EXISTS hierarchy_nodes_type_check
    `.execute(db);

    // Add new constraint with 'template' included
    await sql`
        ALTER TABLE hierarchy_nodes 
        ADD CONSTRAINT hierarchy_nodes_type_check 
        CHECK (type IN ('project', 'process', 'stage', 'subprocess', 'task', 'subtask', 'template'))
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Remove any template nodes first
    await sql`DELETE FROM hierarchy_nodes WHERE type = 'template'`.execute(db);

    // Drop constraint
    await sql`
        ALTER TABLE hierarchy_nodes 
        DROP CONSTRAINT IF EXISTS hierarchy_nodes_type_check
    `.execute(db);

    // Restore old constraint without 'template'
    await sql`
        ALTER TABLE hierarchy_nodes 
        ADD CONSTRAINT hierarchy_nodes_type_check 
        CHECK (type IN ('project', 'process', 'stage', 'subprocess', 'task', 'subtask'))
    `.execute(db);
}
