/**
 * Migration 010: Record Links (Many-to-Many Record Relationships)
 *
 * Implements the polymorphic data mesh pattern for linking records together.
 * This enables arbitrary relationships between any record types:
 * - Contact ↔ Artwork (artist, collector, etc.)
 * - Artwork ↔ Location (current location, exhibition history)
 * - Project ↔ Contact (stakeholders)
 *
 * Design decisions:
 * - Bidirectional: both source and target are equal peers
 * - Typed relationships via link_type field
 * - Optional context stored in metadata JSONB
 * - Soft-delete support via deleted_at
 *
 * Link types are user-defined strings like "artist", "collector", "exhibited_at"
 * This allows flexible relationship modeling without schema changes.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('record_links')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('source_record_id', 'uuid', (col) =>
      col.notNull().references('records.id').onDelete('cascade')
    )
    .addColumn('target_record_id', 'uuid', (col) =>
      col.notNull().references('records.id').onDelete('cascade')
    )
    .addColumn('link_type', 'text', (col) => col.notNull())
    .addColumn('metadata', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('created_by', 'uuid', (col) =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index for finding all links from a record
  await db.schema
    .createIndex('idx_record_links_source')
    .on('record_links')
    .column('source_record_id')
    .execute();

  // Index for finding all links to a record (backlinks)
  await db.schema
    .createIndex('idx_record_links_target')
    .on('record_links')
    .column('target_record_id')
    .execute();

  // Index for filtering by link type
  await db.schema
    .createIndex('idx_record_links_type')
    .on('record_links')
    .column('link_type')
    .execute();

  // Composite index for finding specific relationships
  await db.schema
    .createIndex('idx_record_links_source_type')
    .on('record_links')
    .columns(['source_record_id', 'link_type'])
    .execute();

  // Prevent duplicate links (same source, target, and type)
  await sql`
    ALTER TABLE record_links
    ADD CONSTRAINT record_links_unique_relationship
    UNIQUE (source_record_id, target_record_id, link_type)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('record_links').ifExists().execute();
}
