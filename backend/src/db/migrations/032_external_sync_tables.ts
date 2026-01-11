/**
 * Migration 032: External Sync Tables
 *
 * Adds tables for:
 * - connection_credentials: OAuth tokens per user/provider
 * - external_source_mappings: Links local entities to external sources for sync
 * - user_settings: Per-user preferences
 * - inference_learnings: Store user corrections for future inference
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // 1. Connection Credentials Table
    await db.schema
        .createTable('connection_credentials')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('user_id', 'uuid', (col) =>
            col.references('users.id').onDelete('cascade')
        )
        .addColumn('provider', 'varchar(50)', (col) => col.notNull())
        .addColumn('access_token', 'text', (col) => col.notNull())
        .addColumn('refresh_token', 'text')
        .addColumn('expires_at', 'timestamptz')
        .addColumn('scopes', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
        .addColumn('metadata', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Unique constraint: one credential per user per provider
    await sql`
    CREATE UNIQUE INDEX connection_credentials_user_provider_idx 
    ON connection_credentials (user_id, provider) 
    WHERE user_id IS NOT NULL
  `.execute(db);

    // Allow system-wide credentials (user_id IS NULL)
    await sql`
    CREATE UNIQUE INDEX connection_credentials_system_provider_idx 
    ON connection_credentials (provider) 
    WHERE user_id IS NULL
  `.execute(db);

    // 2. External Source Mappings Table
    await db.schema
        .createTable('external_source_mappings')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('provider', 'varchar(50)', (col) => col.notNull())
        .addColumn('external_id', 'varchar(255)', (col) => col.notNull())
        .addColumn('external_type', 'varchar(50)', (col) => col.notNull())
        .addColumn('local_entity_type', 'varchar(50)', (col) => col.notNull())
        .addColumn('local_entity_id', 'uuid', (col) => col.notNull())
        .addColumn('sync_enabled', 'boolean', (col) =>
            col.notNull().defaultTo(true)
        )
        .addColumn('column_mappings', 'jsonb', (col) =>
            col.defaultTo(sql`'{}'::jsonb`)
        )
        .addColumn('last_synced_at', 'timestamptz')
        .addColumn('last_sync_hash', 'varchar(64)')
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Unique constraint: one mapping per provider + external_id
    await sql`
    CREATE UNIQUE INDEX external_source_mappings_provider_external_idx 
    ON external_source_mappings (provider, external_id)
  `.execute(db);

    // Index for looking up by local entity
    await sql`
    CREATE INDEX external_source_mappings_local_entity_idx 
    ON external_source_mappings (local_entity_id)
  `.execute(db);

    // 3. User Settings Table
    await db.schema
        .createTable('user_settings')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('user_id', 'uuid', (col) =>
            col.notNull().references('users.id').onDelete('cascade')
        )
        .addColumn('setting_key', 'varchar(255)', (col) => col.notNull())
        .addColumn('setting_value', 'jsonb', (col) => col.notNull())
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Unique constraint: one setting per user per key
    await sql`
    CREATE UNIQUE INDEX user_settings_user_key_idx 
    ON user_settings (user_id, setting_key)
  `.execute(db);

    // 4. Inference Learnings Table
    await db.schema
        .createTable('inference_learnings')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('source_type', 'varchar(50)', (col) => col.notNull())
        .addColumn('input_signature', 'jsonb', (col) => col.notNull())
        .addColumn('suggested_mapping', 'jsonb')
        .addColumn('user_mapping', 'jsonb', (col) => col.notNull())
        .addColumn('project_id', 'uuid', (col) =>
            col.references('hierarchy_nodes.id').onDelete('set null')
        )
        .addColumn('definition_id', 'uuid', (col) =>
            col.references('record_definitions.id').onDelete('set null')
        )
        .addColumn('applied_count', 'integer', (col) =>
            col.notNull().defaultTo(0)
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Index for querying learnings by source type
    await sql`
    CREATE INDEX inference_learnings_source_type_idx 
    ON inference_learnings (source_type)
  `.execute(db);

    // Index for project-specific learnings
    await sql`
    CREATE INDEX inference_learnings_project_idx 
    ON inference_learnings (project_id) 
    WHERE project_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('inference_learnings').execute();
    await db.schema.dropTable('user_settings').execute();
    await db.schema.dropTable('external_source_mappings').execute();
    await db.schema.dropTable('connection_credentials').execute();
}
