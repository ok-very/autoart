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
    .execute();

  // Index for finding derived definitions
  await db.schema
    .createIndex('idx_record_definitions_derived')
    .on('record_definitions')
    .column('derived_from_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('record_definitions').ifExists().execute();
}
