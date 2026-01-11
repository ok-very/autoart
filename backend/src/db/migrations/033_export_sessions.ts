/**
 * Migration 033: Export Sessions
 *
 * Creates tables for the export workflow:
 * - export_sessions: Tracks each export attempt with projection cache
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Create export_sessions table
    await db.schema
        .createTable('export_sessions')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('format', 'text', (col) =>
            col.notNull().check(sql`format IN ('rtf', 'markdown', 'plaintext', 'csv', 'google-doc')`)
        )
        .addColumn('status', 'text', (col) =>
            col.notNull().check(sql`status IN ('configuring', 'projecting', 'ready', 'executing', 'completed', 'failed')`)
                .defaultTo('configuring')
        )
        .addColumn('project_ids', 'jsonb', (col) =>
            col.notNull().defaultTo(sql`'[]'::jsonb`)
        )
        .addColumn('options', 'jsonb', (col) =>
            col.notNull().defaultTo(sql`'{}'::jsonb`)
        )
        .addColumn('target_config', 'jsonb', (col) =>
            col.defaultTo(sql`'{}'::jsonb`)
        )
        .addColumn('projection_cache', 'jsonb')
        .addColumn('output_url', 'text')
        .addColumn('error', 'text')
        .addColumn('created_by', 'uuid', (col) =>
            col.references('users.id').onDelete('set null')
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .addColumn('executed_at', 'timestamptz')
        .execute();

    // Add indexes
    await db.schema
        .createIndex('idx_export_sessions_status')
        .on('export_sessions')
        .column('status')
        .execute();

    await db.schema
        .createIndex('idx_export_sessions_created_by')
        .on('export_sessions')
        .column('created_by')
        .execute();

    await db.schema
        .createIndex('idx_export_sessions_format')
        .on('export_sessions')
        .column('format')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('export_sessions').ifExists().execute();
}
