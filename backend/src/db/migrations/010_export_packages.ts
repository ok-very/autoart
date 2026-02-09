/**
 * Migration 010: Export Packages
 *
 * Adds the export_packages table for the package queue system.
 * Packages are the intake/queue layer that wraps export_sessions.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('export_packages')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('label', 'text', (col) => col.notNull())
        .addColumn('source_type', 'text', (col) => col.notNull())
        .addColumn('source_payload', 'jsonb', (col) => col.notNull())
        .addColumn('resolution_state', 'jsonb')
        .addColumn('format', 'text')
        .addColumn('options', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
        .addColumn('target_config', 'jsonb')
        .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
        .addColumn('projection_cache', 'jsonb')
        .addColumn('output_path', 'text')
        .addColumn('output_mime_type', 'text')
        .addColumn('error', 'text')
        .addColumn('export_session_id', 'uuid', (col) =>
            col.references('export_sessions.id').onDelete('set null'))
        .addColumn('submitted_by', 'uuid', (col) =>
            col.references('users.id').onDelete('set null'))
        .addColumn('position', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('executed_at', 'timestamptz')
        .execute();

    await db.schema
        .createIndex('idx_export_packages_status')
        .on('export_packages')
        .column('status')
        .execute();

    await db.schema
        .createIndex('idx_export_packages_position')
        .on('export_packages')
        .column('position')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('export_packages').execute();
}
