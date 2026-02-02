/**
 * Migration 049: Drop action_type_definitions table
 *
 * This table was created in migration 036 but never wired into the Composer.
 * The Composer uses record_definitions with definition_kind='action_arrangement'
 * instead. Remove the orphaned infrastructure.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('action_type_definitions').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Recreate table (from migration 036)
    await db.schema
        .createTable('action_type_definitions')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('type', 'varchar(100)', (col) => col.notNull().unique())
        .addColumn('label', 'varchar(255)', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('field_bindings', 'jsonb', (col) =>
            col.notNull().defaultTo(sql`'{}'::jsonb`)
        )
        .addColumn('defaults', 'jsonb', (col) =>
            col.defaultTo(sql`'{}'::jsonb`)
        )
        .addColumn('is_system', 'boolean', (col) =>
            col.notNull().defaultTo(false)
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Seed with default action types
    await sql`
        INSERT INTO action_type_definitions (type, label, field_bindings, is_system) VALUES
        ('TASK', 'Task', '{"title": "string", "description": "text", "dueDate": "date"}'::jsonb, true),
        ('BUG', 'Bug', '{"title": "string", "description": "text", "severity": "enum"}'::jsonb, true),
        ('STORY', 'Story', '{"title": "string", "description": "text", "points": "number"}'::jsonb, true)
    `.execute(db);

    // Add index
    await db.schema
        .createIndex('idx_action_type_definitions_type')
        .on('action_type_definitions')
        .column('type')
        .execute();
}
