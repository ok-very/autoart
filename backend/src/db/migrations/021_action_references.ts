/**
 * Migration 021: Create action_references Table
 *
 * Creates the new action_references table that links Actions to Records.
 * This replaces the semantic role of task_references in the new foundational model.
 *
 * Design decisions:
 * - New table parallel to task_references (not renaming)
 * - task_references remains read-only for migration period
 * - action_id references actions table, not hierarchy_nodes
 *
 * Part of Phase 4: API Surface (Ontology-Safe)
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create action_references table
  await db.schema
    .createTable('action_references')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('action_id', 'uuid', (col) =>
      col.notNull().references('actions.id').onDelete('cascade')
    )
    .addColumn('source_record_id', 'uuid', (col) =>
      col.references('records.id').onDelete('set null')
    )
    .addColumn('target_field_key', 'varchar(255)')
    .addColumn('mode', sql`ref_mode`, (col) => col.notNull().defaultTo('dynamic'))
    .addColumn('snapshot_value', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    // Track legacy reference for traceability
    .addColumn('legacy_task_reference_id', 'uuid', (col) =>
      col.references('task_references.id').onDelete('set null')
    )
    .execute();

  // Create indexes for common queries
  await db.schema
    .createIndex('idx_action_references_action_id')
    .on('action_references')
    .column('action_id')
    .execute();

  await db.schema
    .createIndex('idx_action_references_source_record_id')
    .on('action_references')
    .column('source_record_id')
    .execute();

  console.log('  ✓ Created action_references table');
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('action_references').execute();
  console.log('  ✓ Dropped action_references table');
}
