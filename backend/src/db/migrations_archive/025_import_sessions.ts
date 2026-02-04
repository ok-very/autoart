/**
 * Migration 025: Import Sessions
 *
 * Creates tables for the import workflow:
 * - import_sessions: Tracks each import attempt
 * - import_plans: Stores generated import plans (JSON)
 * - import_executions: Records execution results
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Create import_sessions table
    await db.schema
        .createTable('import_sessions')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('parser_name', 'text', (col) => col.notNull())
        .addColumn('status', 'text', (col) =>
            col.notNull().check(sql`status IN ('pending', 'planned', 'executing', 'completed', 'failed')`)
        )
        .addColumn('raw_data', 'text', (col) => col.notNull())
        .addColumn('parser_config', 'jsonb', (col) =>
            col.notNull().defaultTo(sql`'{}'::jsonb`)
        )
        .addColumn('target_project_id', 'uuid', (col) =>
            col.references('hierarchy_nodes.id').onDelete('set null')
        )
        .addColumn('created_by', 'uuid', (col) =>
            col.references('users.id').onDelete('set null')
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .execute();

    // Create import_plans table
    await db.schema
        .createTable('import_plans')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('session_id', 'uuid', (col) =>
            col.notNull().references('import_sessions.id').onDelete('cascade')
        )
        .addColumn('plan_data', 'jsonb', (col) => col.notNull())
        .addColumn('validation_issues', 'jsonb', (col) =>
            col.notNull().defaultTo(sql`'[]'::jsonb`)
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .execute();

    // Create import_executions table
    await db.schema
        .createTable('import_executions')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('session_id', 'uuid', (col) =>
            col.notNull().references('import_sessions.id').onDelete('cascade')
        )
        .addColumn('plan_id', 'uuid', (col) =>
            col.notNull().references('import_plans.id').onDelete('cascade')
        )
        .addColumn('status', 'text', (col) =>
            col.notNull().check(sql`status IN ('running', 'completed', 'failed')`)
        )
        .addColumn('results', 'jsonb')
        .addColumn('started_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`NOW()`)
        )
        .addColumn('completed_at', 'timestamptz')
        .execute();

    // Add indexes
    await db.schema
        .createIndex('idx_import_sessions_status')
        .on('import_sessions')
        .column('status')
        .execute();

    await db.schema
        .createIndex('idx_import_sessions_created_by')
        .on('import_sessions')
        .column('created_by')
        .execute();

    await db.schema
        .createIndex('idx_import_plans_session')
        .on('import_plans')
        .column('session_id')
        .execute();

    await db.schema
        .createIndex('idx_import_executions_session')
        .on('import_executions')
        .column('session_id')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('import_executions').ifExists().execute();
    await db.schema.dropTable('import_plans').ifExists().execute();
    await db.schema.dropTable('import_sessions').ifExists().execute();
}
