/**
 * Migration 018: Add Subtask Node Type
 *
 * Extends the node_type enum to include 'subtask' as a child of task nodes.
 * This enables a 6-level hierarchy: project → process → stage → subprocess → task → subtask
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Add 'subtask' value to the node_type enum
    await sql`ALTER TYPE node_type ADD VALUE 'subtask'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // PostgreSQL doesn't support removing enum values directly.
    // We need to recreate the enum without 'subtask'.
    // First, delete any subtask nodes.
    await sql`DELETE FROM hierarchy_nodes WHERE type = 'subtask'`.execute(db);

    // Rename old enum
    await sql`ALTER TYPE node_type RENAME TO node_type_old`.execute(db);

    // Create new enum without subtask
    await sql`
    CREATE TYPE node_type AS ENUM (
      'project',
      'process',
      'stage',
      'subprocess',
      'task'
    )
  `.execute(db);

    // Update column to use new enum
    await sql`
    ALTER TABLE hierarchy_nodes 
    ALTER COLUMN type TYPE node_type 
    USING type::text::node_type
  `.execute(db);

    // Drop old enum
    await sql`DROP TYPE node_type_old`.execute(db);
}
