/**
 * Migration 004: Record Definitions (Schema Registry)
 *
 * Record definitions are the "meta-schema" - they define what fields
 * a record type has. This is the polymorphic data mesh foundation.
 *
 * Design decisions:
 * - schema_config is JSONB containing field definitions
 * - derived_from_id enables schema inheritance/forking
 * - styling allows per-type visual customization
 * - project_id links a definition to a specific project's template library
 * - is_template marks definition as a reusable template
 * - clone_excluded when true, definition is NOT cloned when cloning projects
 * - pinned when true, definition appears in quick create menu
 *
 * Example schema_config:
 * {
 *   "fields": [
 *     { "key": "name", "type": "text", "label": "Name", "required": true },
 *     { "key": "email", "type": "email", "label": "Email" },
 *     { "key": "role", "type": "select", "label": "Role", "options": ["Client", "Vendor"] }
 *   ]
 * }
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('record_definitions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('derived_from_id', 'uuid', (col) =>
      col.references('record_definitions.id').onDelete('set null')
    )
    .addColumn('schema_config', 'jsonb', (col) => col.notNull())
    .addColumn('styling', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    // Template/library columns (consolidated from migrations 011, 012, 014)
    .addColumn('project_id', 'uuid') // FK added after hierarchy_nodes table exists
    .addColumn('is_template', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('clone_excluded', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('pinned', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  // Index for finding derived definitions
  await db.schema
    .createIndex('idx_record_definitions_derived')
    .on('record_definitions')
    .column('derived_from_id')
    .execute();

  // Unique constraint on name for idempotent inserts
  await sql`
    ALTER TABLE record_definitions ADD CONSTRAINT record_definitions_name_unique UNIQUE (name)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('record_definitions').ifExists().execute();
}
