/**
 * Migration 007: Task References (The Link Layer)
 *
 * References mediate between tasks and records, implementing the
 * Static vs Dynamic behavior described in the architecture.
 *
 * Design decisions:
 * - Each reference has its own UUID (the "new UUID" mentioned in spec)
 * - mode determines behavior: static = snapshot, dynamic = live link
 * - snapshot_value stores the value at creation time (for static mode)
 * - source_record_id preserves lineage even for static references
 * - Enables "drift detection" by comparing snapshot to current value
 *
 * Reference Lifecycle:
 * 1. User types #record:field in task description
 * 2. System creates task_reference with mode='dynamic'
 * 3. User can switch to static (captures snapshot)
 * 4. User can edit static value independently
 * 5. User can "re-link" (switch back to dynamic)
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
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

  // Index for finding all references in a task
  await db.schema
    .createIndex('idx_references_task')
    .on('task_references')
    .column('task_id')
    .execute();

  // Index for backlinks (finding all tasks that reference a record)
  await db.schema
    .createIndex('idx_references_source')
    .on('task_references')
    .column('source_record_id')
    .execute();

  // Index for filtering by mode
  await db.schema
    .createIndex('idx_references_mode')
    .on('task_references')
    .column('mode')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('task_references').ifExists().execute();
}
