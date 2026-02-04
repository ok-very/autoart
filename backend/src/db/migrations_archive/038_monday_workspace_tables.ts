/**
 * Migration 038: Monday Workspace Configuration Tables
 *
 * Adds tables for advanced Monday.com integration with configuration-driven interpretation:
 * - monday_workspaces: Top-level integration context
 * - monday_board_configs: Per-board role and settings
 * - monday_group_configs: Per-group role and stage configuration
 * - monday_column_configs: Per-column semantic mapping
 * - monday_sync_states: Incremental sync tracking
 *
 * Also extends external_source_mappings with workspace context.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // 1. Monday Workspaces Table - Top-level integration container
    await db.schema
        .createTable('monday_workspaces')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('name', 'varchar(255)', (col) => col.notNull())
        .addColumn('provider_account_id', 'varchar(255)')
        .addColumn('default_project_id', 'uuid', (col) =>
            col.references('hierarchy_nodes.id').onDelete('set null')
        )
        .addColumn('settings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
        .addColumn('created_by', 'uuid', (col) =>
            col.references('users.id').onDelete('set null')
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Index for provider account lookup
    await sql`
    CREATE INDEX monday_workspaces_provider_account_idx 
    ON monday_workspaces (provider_account_id) 
    WHERE provider_account_id IS NOT NULL
  `.execute(db);

    // 2. Monday Board Configs Table - Per-board role and interpretation settings
    await db.schema
        .createTable('monday_board_configs')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('workspace_id', 'uuid', (col) =>
            col.notNull().references('monday_workspaces.id').onDelete('cascade')
        )
        .addColumn('board_id', 'varchar(50)', (col) => col.notNull())
        .addColumn('board_name', 'varchar(255)', (col) => col.notNull())
        .addColumn('role', 'varchar(50)', (col) => col.notNull())
        .addColumn('linked_project_id', 'uuid', (col) =>
            col.references('hierarchy_nodes.id').onDelete('set null')
        )
        .addColumn('template_scope', 'varchar(50)')
        .addColumn('sync_direction', 'varchar(20)', (col) =>
            col.notNull().defaultTo('pull')
        )
        .addColumn('sync_enabled', 'boolean', (col) =>
            col.notNull().defaultTo(true)
        )
        .addColumn('settings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Unique constraint: one config per board per workspace
    await sql`
    CREATE UNIQUE INDEX monday_board_configs_workspace_board_idx 
    ON monday_board_configs (workspace_id, board_id)
  `.execute(db);

    // Index for board lookup
    await sql`
    CREATE INDEX monday_board_configs_board_id_idx 
    ON monday_board_configs (board_id)
  `.execute(db);

    // 3. Monday Group Configs Table - Per-group role and stage settings
    await db.schema
        .createTable('monday_group_configs')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('board_config_id', 'uuid', (col) =>
            col.notNull().references('monday_board_configs.id').onDelete('cascade')
        )
        .addColumn('group_id', 'varchar(100)', (col) => col.notNull())
        .addColumn('group_title', 'varchar(255)', (col) => col.notNull())
        .addColumn('role', 'varchar(50)', (col) => col.notNull())
        .addColumn('stage_order', 'integer')
        .addColumn('stage_kind', 'varchar(50)')
        .addColumn('subprocess_name_override', 'varchar(255)')
        .addColumn('settings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Unique constraint: one config per group per board config
    await sql`
    CREATE UNIQUE INDEX monday_group_configs_board_group_idx 
    ON monday_group_configs (board_config_id, group_id)
  `.execute(db);

    // 4. Monday Column Configs Table - Per-column semantic mapping
    await db.schema
        .createTable('monday_column_configs')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('board_config_id', 'uuid', (col) =>
            col.notNull().references('monday_board_configs.id').onDelete('cascade')
        )
        .addColumn('column_id', 'varchar(100)', (col) => col.notNull())
        .addColumn('column_title', 'varchar(255)', (col) => col.notNull())
        .addColumn('column_type', 'varchar(100)', (col) => col.notNull())
        .addColumn('semantic_role', 'varchar(50)', (col) => col.notNull())
        .addColumn('local_field_key', 'varchar(255)')
        .addColumn('fact_kind_id', 'uuid', (col) =>
            col.references('fact_kind_definitions.id').onDelete('set null')
        )
        .addColumn('render_hint', 'varchar(100)')
        .addColumn('is_required', 'boolean', (col) =>
            col.notNull().defaultTo(false)
        )
        .addColumn('multi_valued', 'boolean', (col) =>
            col.notNull().defaultTo(false)
        )
        .addColumn('settings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Unique constraint: one config per column per board config
    await sql`
    CREATE UNIQUE INDEX monday_column_configs_board_column_idx 
    ON monday_column_configs (board_config_id, column_id)
  `.execute(db);

    // 5. Monday Sync States Table - Incremental sync tracking
    await db.schema
        .createTable('monday_sync_states')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`)
        )
        .addColumn('board_config_id', 'uuid', (col) =>
            col.notNull().references('monday_board_configs.id').onDelete('cascade')
        )
        .addColumn('last_activity_log_id', 'varchar(50)')
        .addColumn('last_synced_at', 'timestamptz')
        .addColumn('sync_cursor', 'jsonb')
        .addColumn('items_synced', 'integer', (col) =>
            col.notNull().defaultTo(0)
        )
        .addColumn('errors', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
        .addColumn('created_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.notNull().defaultTo(sql`now()`)
        )
        .execute();

    // Unique constraint: one sync state per board config
    await sql`
    CREATE UNIQUE INDEX monday_sync_states_board_config_idx 
    ON monday_sync_states (board_config_id)
  `.execute(db);

    // 6. Extend external_source_mappings with workspace context
    await db.schema
        .alterTable('external_source_mappings')
        .addColumn('workspace_id', 'uuid', (col) =>
            col.references('monday_workspaces.id').onDelete('set null')
        )
        .addColumn('external_board_id', 'varchar(50)')
        .addColumn('external_group_id', 'varchar(100)')
        .execute();

    // Index for workspace lookups
    await sql`
    CREATE INDEX external_source_mappings_workspace_idx 
    ON external_source_mappings (workspace_id) 
    WHERE workspace_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Remove added columns from external_source_mappings
    await db.schema
        .alterTable('external_source_mappings')
        .dropColumn('external_group_id')
        .execute();
    await db.schema
        .alterTable('external_source_mappings')
        .dropColumn('external_board_id')
        .execute();
    await db.schema
        .alterTable('external_source_mappings')
        .dropColumn('workspace_id')
        .execute();

    // Drop tables in reverse order (respecting foreign keys)
    await db.schema.dropTable('monday_sync_states').execute();
    await db.schema.dropTable('monday_column_configs').execute();
    await db.schema.dropTable('monday_group_configs').execute();
    await db.schema.dropTable('monday_board_configs').execute();
    await db.schema.dropTable('monday_workspaces').execute();
}
