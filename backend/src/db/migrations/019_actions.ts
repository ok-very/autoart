/**
 * Migration 019: Actions Table
 *
 * Introduces the Actions primitive as part of the foundational events model.
 * Actions declare intent - that something should or could happen.
 *
 * Design decisions:
 * - context_id + context_type enables scaling from subprocess → stage → process → project → record
 * - field_bindings stores JSONB mappings to Field definitions
 * - NO status, progress, completed_at, or assignee columns - Actions don't know outcomes
 * - Outcomes are determined by interpreting Events against Actions
 *
 * Part of the four first-class primitives:
 * - Records hold context
 * - Fields hold data
 * - Actions hold intent
 * - Events hold truth
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Context type enum - defines what scope an action/event belongs to
  // Starts with subprocess (Phase 1), will expand to stage, process, project, record
  await sql`
    CREATE TYPE context_type AS ENUM (
      'subprocess',
      'stage',
      'process',
      'project',
      'record'
    )
  `.execute(db);

  // Actions table - intent declarations
  await db.schema
    .createTable('actions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('context_id', 'uuid', (col) => col.notNull())
    .addColumn('context_type', sql`context_type`, (col) => col.notNull())
    .addColumn('parent_action_id', 'uuid', (col) =>
      col.references('actions.id').onDelete('cascade')
    )
    .addColumn('type', 'varchar(100)', (col) => col.notNull())
    .addColumn('field_bindings', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`)
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index for context-scoped queries (most common access pattern)
  await db.schema
    .createIndex('idx_actions_context')
    .on('actions')
    .columns(['context_id', 'context_type'])
    .execute();

  // Index for filtering by action type
  await db.schema
    .createIndex('idx_actions_type')
    .on('actions')
    .column('type')
    .execute();

  // Index for parent action queries (tree traversal)
  await db.schema
    .createIndex('idx_actions_parent')
    .on('actions')
    .column('parent_action_id')
    .execute();

  // Index for chronological ordering
  await db.schema
    .createIndex('idx_actions_created')
    .on('actions')
    .column('created_at')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('actions').ifExists().execute();
  await sql`DROP TYPE IF EXISTS context_type`.execute(db);
}
