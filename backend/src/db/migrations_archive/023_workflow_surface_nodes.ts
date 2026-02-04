/**
 * Migration 023: Workflow Surface Nodes (Materialized Projection)
 *
 * This table stores the materialized projection of the workflow surface tree.
 * It is NOT authoritative - the source of truth is Actions + Events.
 * This table is re-computed whenever events are emitted.
 *
 * Key design principles:
 * - Projector reads actions + events
 * - Calls interpreter (pure, deterministic)
 * - Writes only UI-facing cached/ordering fields
 * - Never defines semantics (status/lifecycle rules live in interpreter)
 *
 * Dependency semantics:
 * - DEPENDENCY_ADDED on Action A with { dependsOnActionId: B }
 *   means "A is blocked by B" / "B must complete before A"
 * - Tree representation: A is parent, B is child (B shown nested under A)
 *
 * The table supports:
 * - Multiple surface types (workflow_table, kanban, etc.)
 * - Recursive tree structure via parent_action_id
 * - Cached payload for fast reads (no interpretation at query time)
 * - Manual row ordering via position field
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Workflow surface nodes table
  await db.schema
    .createTable('workflow_surface_nodes')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('surface_type', 'varchar(100)', (col) => col.notNull())
    .addColumn('context_id', 'uuid', (col) => col.notNull())
    .addColumn('context_type', sql`context_type`, (col) => col.notNull())
    .addColumn('action_id', 'uuid', (col) =>
      col.notNull().references('actions.id').onDelete('cascade')
    )
    .addColumn('parent_action_id', 'uuid', (col) =>
      col.references('actions.id').onDelete('cascade')
    )
    .addColumn('depth', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('position', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('payload', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('flags', 'jsonb', (col) =>
      col.defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('rendered_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addColumn('last_event_occurred_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Unique constraint: one surface node per (surface_type, context_id, action_id)
  await db.schema
    .createIndex('idx_workflow_surface_unique')
    .on('workflow_surface_nodes')
    .columns(['surface_type', 'context_id', 'action_id'])
    .unique()
    .execute();

  // Index for tree queries (parent + position ordering)
  await db.schema
    .createIndex('idx_workflow_surface_tree')
    .on('workflow_surface_nodes')
    .columns(['surface_type', 'context_id', 'parent_action_id', 'position'])
    .execute();

  // Index for context-scoped queries
  await db.schema
    .createIndex('idx_workflow_surface_context')
    .on('workflow_surface_nodes')
    .columns(['context_id', 'context_type'])
    .execute();

  // Index for action lookups
  await db.schema
    .createIndex('idx_workflow_surface_action')
    .on('workflow_surface_nodes')
    .column('action_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('workflow_surface_nodes').ifExists().execute();
}
