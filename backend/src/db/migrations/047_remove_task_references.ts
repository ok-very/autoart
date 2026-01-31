/**
 * Migration 047: Remove task_references table and legacy column
 *
 * Completes the removal of the deprecated task_references system:
 * 1. Drops the legacy_task_reference_id FK and column from action_references
 * 2. Drops the task_references table and its indexes
 *
 * The task_references table was replaced by action_references in migration 021.
 * All data has been migrated and the old table is no longer read or written.
 *
 * Closes #218
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Drop FK constraint on action_references.legacy_task_reference_id
  await sql`
    ALTER TABLE action_references
      DROP CONSTRAINT IF EXISTS action_references_legacy_task_reference_id_fkey
  `.execute(db);

  // 2. Drop the legacy column
  await sql`
    ALTER TABLE action_references
      DROP COLUMN IF EXISTS legacy_task_reference_id
  `.execute(db);

  // 3. Drop task_references indexes
  await sql`DROP INDEX IF EXISTS idx_references_task`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_references_source`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_references_mode`.execute(db);

  // 4. Drop task_references table
  await sql`DROP TABLE IF EXISTS task_references`.execute(db);

  console.log('  ✓ Removed task_references table and legacy_task_reference_id column');
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Recreate task_references table (empty — data loss is expected)
  await db.schema
    .createTable('task_references')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('task_id', 'uuid', (col) =>
      col.notNull().references('hierarchy_nodes.id').onDelete('cascade')
    )
    .addColumn('source_record_id', 'uuid', (col) =>
      col.references('records.id').onDelete('set null')
    )
    .addColumn('target_field_key', 'text')
    .addColumn('mode', sql`ref_mode`, (col) =>
      col.notNull().defaultTo('dynamic')
    )
    .addColumn('snapshot_value', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Recreate indexes
  await db.schema
    .createIndex('idx_references_task')
    .on('task_references')
    .column('task_id')
    .execute();

  await db.schema
    .createIndex('idx_references_source')
    .on('task_references')
    .column('source_record_id')
    .execute();

  await db.schema
    .createIndex('idx_references_mode')
    .on('task_references')
    .column('mode')
    .execute();

  // Re-add legacy column to action_references
  await sql`
    ALTER TABLE action_references
      ADD COLUMN legacy_task_reference_id uuid
        REFERENCES task_references(id) ON DELETE SET NULL
  `.execute(db);

  console.log('  ✓ Recreated task_references table and legacy_task_reference_id column');
}
