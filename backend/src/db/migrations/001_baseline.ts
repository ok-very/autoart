/**
 * Migration 001: Baseline Schema
 *
 * Consolidated schema snapshot as of 2026-02-04.
 * Replaces 50+ incremental migrations.
 *
 * Tables: 36
 * Enums: 5
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // ==========================================================================
  // EXTENSIONS
  // ==========================================================================
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

  // ==========================================================================
  // ENUMS
  // ==========================================================================

  await sql`CREATE TYPE context_type AS ENUM ('subprocess', 'stage', 'process', 'project', 'record')`.execute(db);
  await sql`CREATE TYPE intake_form_status AS ENUM ('active', 'disabled')`.execute(db);
  await sql`CREATE TYPE node_type AS ENUM ('project', 'process', 'stage', 'subprocess', 'template')`.execute(db);
  await sql`CREATE TYPE poll_status AS ENUM ('active', 'closed', 'draft')`.execute(db);
  await sql`CREATE TYPE ref_mode AS ENUM ('static', 'dynamic')`.execute(db);

  // ==========================================================================
  // TABLES
  // ==========================================================================

  // engagements
  await db.schema
    .createTable('engagements')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('context_type', 'text', (col) => col.notNull())
    .addColumn('context_id', 'text', (col) => col.notNull())
    .addColumn('actor_name', 'text')
    .addColumn('payload', 'jsonb')
    .addColumn('occurred_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // intake_forms
  await db.schema
    .createTable('intake_forms')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('unique_id', 'text', (col) => col.notNull().unique())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('status', sql`intake_form_status`, (col) => col.notNull().defaultTo(sql`'active'::intake_form_status`))
    .addColumn('sharepoint_request_url', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // record_definitions
  await db.schema
    .createTable('record_definitions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('derived_from_id', 'uuid', (col) => col.references('record_definitions.id').onDelete('set null'))
    .addColumn('schema_config', 'jsonb', (col) => col.notNull())
    .addColumn('styling', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('project_id', 'uuid')
    .addColumn('is_template', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('clone_excluded', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('pinned', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('is_system', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('parent_definition_id', 'uuid', (col) => col.references('record_definitions.id').onDelete('set null'))
    .addColumn('definition_kind', 'text', (col) => col.notNull().defaultTo(sql`'record'::text`))
    .execute();

  // users
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('deleted_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('role', 'text', (col) => col.notNull().defaultTo(sql`'user'::text`))
    .addColumn('avatar_url', 'text')
    .execute();

  // workflow_surface_nodes
  await db.schema
    .createTable('workflow_surface_nodes')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('surface_type', 'varchar(255)', (col) => col.notNull())
    .addColumn('context_id', 'uuid', (col) => col.notNull())
    .addColumn('context_type', sql`context_type`, (col) => col.notNull())
    .addColumn('action_id', 'uuid', (col) => col.notNull())
    .addColumn('parent_action_id', 'uuid')
    .addColumn('depth', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('position', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('payload', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('flags', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('rendered_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('last_event_occurred_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // intake_form_pages
  await db.schema
    .createTable('intake_form_pages')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('form_id', 'uuid', (col) => col.notNull().references('intake_forms.id').onDelete('cascade'))
    .addColumn('page_index', 'integer', (col) => col.notNull())
    .addColumn('blocks_config', 'jsonb', (col) => col.notNull())
    .execute();

  // intake_submissions
  await db.schema
    .createTable('intake_submissions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('form_id', 'uuid', (col) => col.notNull().references('intake_forms.id').onDelete('cascade'))
    .addColumn('upload_code', 'text', (col) => col.notNull())
    .addColumn('metadata', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('created_records', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
    .execute();

  // actions
  await db.schema
    .createTable('actions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('context_id', 'uuid', (col) => col.notNull())
    .addColumn('context_type', sql`context_type`, (col) => col.notNull())
    .addColumn('parent_action_id', 'uuid', (col) => col.references('actions.id').onDelete('cascade'))
    .addColumn('type', 'varchar(255)', (col) => col.notNull())
    .addColumn('field_bindings', 'jsonb', (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('definition_id', 'uuid', (col) => col.references('record_definitions.id').onDelete('set null'))
    .execute();

  // autohelper_commands
  await db.schema
    .createTable('autohelper_commands')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('command_type', 'varchar(255)', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('status', 'varchar(255)', (col) => col.notNull().defaultTo(sql`'pending'::character varying`))
    .addColumn('result', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('acknowledged_at', 'timestamptz')
    .execute();

  // autohelper_instances
  await db.schema
    .createTable('autohelper_instances')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().unique().references('users.id'))
    .addColumn('settings', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('settings_version', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('status', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('last_seen', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // connection_credentials
  await db.schema
    .createTable('connection_credentials')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('provider', 'varchar(255)', (col) => col.notNull())
    .addColumn('access_token', 'text', (col) => col.notNull())
    .addColumn('refresh_token', 'text')
    .addColumn('expires_at', 'timestamptz')
    .addColumn('scopes', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
    .addColumn('metadata', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // export_sessions
  await db.schema
    .createTable('export_sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('format', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo(sql`'configuring'::text`))
    .addColumn('project_ids', 'jsonb', (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('options', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('target_config', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('projection_cache', 'jsonb')
    .addColumn('output_url', 'text')
    .addColumn('error', 'text')
    .addColumn('created_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('executed_at', 'timestamptz')
    .addColumn('output_path', 'text')
    .addColumn('output_mime_type', 'text')
    .execute();

  // fact_kind_definitions
  await db.schema
    .createTable('fact_kind_definitions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('fact_kind', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('display_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('payload_schema', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('example_payload', 'jsonb')
    .addColumn('source', 'varchar(255)', (col) => col.notNull().defaultTo(sql`'csv-import'::character varying`))
    .addColumn('confidence', 'varchar(255)', (col) => col.notNull().defaultTo(sql`'low'::character varying`))
    .addColumn('needs_review', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('is_known', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('first_seen_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('reviewed_at', 'timestamptz')
    .addColumn('reviewed_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .execute();

  // hierarchy_nodes
  await db.schema
    .createTable('hierarchy_nodes')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('parent_id', 'uuid', (col) => col.references('hierarchy_nodes.id').onDelete('cascade'))
    .addColumn('root_project_id', 'uuid', (col) => col.references('hierarchy_nodes.id').onDelete('cascade'))
    .addColumn('type', sql`node_type`, (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'jsonb')
    .addColumn('position', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('default_record_def_id', 'uuid')
    .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('is_template', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // sessions
  await db.schema
    .createTable('sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('refresh_token', 'text', (col) => col.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // user_settings
  await db.schema
    .createTable('user_settings')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('setting_key', 'varchar(255)', (col) => col.notNull())
    .addColumn('setting_value', 'jsonb', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // events
  await db.schema
    .createTable('events')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('context_id', 'uuid', (col) => col.notNull())
    .addColumn('context_type', sql`context_type`, (col) => col.notNull())
    .addColumn('action_id', 'uuid', (col) => col.references('actions.id').onDelete('cascade'))
    .addColumn('type', 'varchar(255)', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('actor_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('occurred_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // import_sessions
  await db.schema
    .createTable('import_sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('parser_name', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('raw_data', 'text', (col) => col.notNull())
    .addColumn('parser_config', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('target_project_id', 'uuid', (col) => col.references('hierarchy_nodes.id').onDelete('set null'))
    .addColumn('created_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // inference_learnings
  await db.schema
    .createTable('inference_learnings')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('source_type', 'varchar(255)', (col) => col.notNull())
    .addColumn('input_signature', 'jsonb', (col) => col.notNull())
    .addColumn('suggested_mapping', 'jsonb')
    .addColumn('user_mapping', 'jsonb', (col) => col.notNull())
    .addColumn('project_id', 'uuid', (col) => col.references('hierarchy_nodes.id').onDelete('set null'))
    .addColumn('definition_id', 'uuid', (col) => col.references('record_definitions.id').onDelete('set null'))
    .addColumn('applied_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // mail_messages
  await db.schema
    .createTable('mail_messages')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('external_id', 'text', (col) => col.notNull().unique())
    .addColumn('subject', 'text')
    .addColumn('sender', 'text')
    .addColumn('sender_name', 'text')
    .addColumn('received_at', 'timestamptz')
    .addColumn('body_preview', 'text')
    .addColumn('metadata', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('project_id', 'uuid', (col) => col.references('hierarchy_nodes.id').onDelete('set null'))
    .addColumn('promoted_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('promoted_by', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('body_html', 'text')
    .execute();

  // monday_workspaces
  await db.schema
    .createTable('monday_workspaces')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('provider_account_id', 'varchar(255)')
    .addColumn('default_project_id', 'uuid', (col) => col.references('hierarchy_nodes.id').onDelete('set null'))
    .addColumn('settings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // polls
  await db.schema
    .createTable('polls')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('unique_id', 'text', (col) => col.notNull().unique())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('status', sql`poll_status`, (col) => col.notNull().defaultTo(sql`'active'::poll_status`))
    .addColumn('time_config', 'jsonb', (col) => col.notNull())
    .addColumn('project_id', 'uuid', (col) => col.references('hierarchy_nodes.id').onDelete('set null'))
    .addColumn('created_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('closed_at', 'timestamptz')
    .addColumn('confirmation_message', 'text')
    .execute();

  // project_members
  await db.schema
    .createTable('project_members')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('project_id', 'uuid', (col) => col.notNull().references('hierarchy_nodes.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('role', 'text', (col) => col.notNull().defaultTo(sql`'member'::text`))
    .addColumn('assigned_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('assigned_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addUniqueConstraint('uq_project_members_project_user', ['project_id', 'user_id'])
    .execute();

  // records
  await db.schema
    .createTable('records')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('definition_id', 'uuid', (col) => col.notNull().references('record_definitions.id').onDelete('restrict'))
    .addColumn('classification_node_id', 'uuid', (col) => col.references('hierarchy_nodes.id').onDelete('set null'))
    .addColumn('unique_name', 'text', (col) => col.notNull())
    .addColumn('data', 'jsonb', (col) => col.notNull())
    .addColumn('created_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // import_plans
  await db.schema
    .createTable('import_plans')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('session_id', 'uuid', (col) => col.notNull().references('import_sessions.id').onDelete('cascade'))
    .addColumn('plan_data', 'jsonb', (col) => col.notNull())
    .addColumn('validation_issues', 'jsonb', (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // mail_links
  await db.schema
    .createTable('mail_links')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('mail_message_id', 'uuid', (col) => col.notNull().references('mail_messages.id').onDelete('cascade'))
    .addColumn('target_type', 'text', (col) => col.notNull())
    .addColumn('target_id', 'uuid', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('created_by', 'uuid', (col) => col.notNull().references('users.id'))
    .addUniqueConstraint('uq_mail_links_message_target', ['mail_message_id', 'target_type', 'target_id'])
    .execute();

  // external_source_mappings
  await db.schema
    .createTable('external_source_mappings')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('provider', 'varchar(255)', (col) => col.notNull())
    .addColumn('external_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('external_type', 'varchar(255)', (col) => col.notNull())
    .addColumn('local_entity_type', 'varchar(255)', (col) => col.notNull())
    .addColumn('local_entity_id', 'uuid', (col) => col.notNull())
    .addColumn('sync_enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('column_mappings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('last_synced_at', 'timestamptz')
    .addColumn('last_sync_hash', 'varchar(255)')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('workspace_id', 'uuid', (col) => col.references('monday_workspaces.id').onDelete('set null'))
    .addColumn('external_board_id', 'varchar(255)')
    .addColumn('external_group_id', 'varchar(255)')
    .execute();

  // monday_board_configs
  await db.schema
    .createTable('monday_board_configs')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('monday_workspaces.id').onDelete('cascade'))
    .addColumn('board_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('board_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('role', 'varchar(255)', (col) => col.notNull())
    .addColumn('linked_project_id', 'uuid', (col) => col.references('hierarchy_nodes.id').onDelete('set null'))
    .addColumn('template_scope', 'varchar(255)')
    .addColumn('sync_direction', 'varchar(255)', (col) => col.notNull().defaultTo(sql`'pull'::character varying`))
    .addColumn('sync_enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('settings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // poll_responses
  await db.schema
    .createTable('poll_responses')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('poll_id', 'uuid', (col) => col.notNull().references('polls.id').onDelete('cascade'))
    .addColumn('participant_name', 'text', (col) => col.notNull())
    .addColumn('participant_email', 'text')
    .addColumn('available_slots', 'jsonb', (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('poll_responses_poll_participant_unique', ['poll_id', 'participant_name'])
    .execute();

  // action_references
  await db.schema
    .createTable('action_references')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('action_id', 'uuid', (col) => col.notNull().references('actions.id').onDelete('cascade'))
    .addColumn('source_record_id', 'uuid', (col) => col.references('records.id').onDelete('set null'))
    .addColumn('target_field_key', 'varchar(255)')
    .addColumn('mode', sql`ref_mode`, (col) => col.notNull().defaultTo(sql`'dynamic'::ref_mode`))
    .addColumn('snapshot_value', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // record_aliases
  await db.schema
    .createTable('record_aliases')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('record_id', 'uuid', (col) => col.notNull().references('records.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('type', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // record_links
  await db.schema
    .createTable('record_links')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('source_record_id', 'uuid', (col) => col.notNull().references('records.id').onDelete('cascade'))
    .addColumn('target_record_id', 'uuid', (col) => col.notNull().references('records.id').onDelete('cascade'))
    .addColumn('link_type', 'text', (col) => col.notNull())
    .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_by', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('record_links_unique_relationship', ['source_record_id', 'target_record_id', 'link_type'])
    .execute();

  // import_executions
  await db.schema
    .createTable('import_executions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('session_id', 'uuid', (col) => col.notNull().references('import_sessions.id').onDelete('cascade'))
    .addColumn('plan_id', 'uuid', (col) => col.notNull().references('import_plans.id').onDelete('cascade'))
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('results', 'jsonb')
    .addColumn('started_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('completed_at', 'timestamptz')
    .execute();

  // monday_column_configs
  await db.schema
    .createTable('monday_column_configs')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('board_config_id', 'uuid', (col) => col.notNull().references('monday_board_configs.id').onDelete('cascade'))
    .addColumn('column_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('column_title', 'varchar(255)', (col) => col.notNull())
    .addColumn('column_type', 'varchar(255)', (col) => col.notNull())
    .addColumn('semantic_role', 'varchar(255)', (col) => col.notNull())
    .addColumn('local_field_key', 'varchar(255)')
    .addColumn('fact_kind_id', 'uuid', (col) => col.references('fact_kind_definitions.id').onDelete('set null'))
    .addColumn('render_hint', 'varchar(255)')
    .addColumn('is_required', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('multi_valued', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('settings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // monday_group_configs
  await db.schema
    .createTable('monday_group_configs')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('board_config_id', 'uuid', (col) => col.notNull().references('monday_board_configs.id').onDelete('cascade'))
    .addColumn('group_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('group_title', 'varchar(255)', (col) => col.notNull())
    .addColumn('role', 'varchar(255)', (col) => col.notNull())
    .addColumn('stage_order', 'integer')
    .addColumn('stage_kind', 'varchar(255)')
    .addColumn('subprocess_name_override', 'varchar(255)')
    .addColumn('settings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // monday_sync_states
  await db.schema
    .createTable('monday_sync_states')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('board_config_id', 'uuid', (col) => col.notNull().references('monday_board_configs.id').onDelete('cascade'))
    .addColumn('last_activity_log_id', 'varchar(255)')
    .addColumn('last_synced_at', 'timestamptz')
    .addColumn('sync_cursor', 'jsonb')
    .addColumn('items_synced', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('errors', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ==========================================================================
  // DEFERRED FOREIGN KEYS (circular dependencies)
  // ==========================================================================

  await sql`ALTER TABLE record_definitions ADD CONSTRAINT record_definitions_project_id_fkey FOREIGN KEY (project_id) REFERENCES hierarchy_nodes(id) ON DELETE CASCADE`.execute(db);
  await sql`ALTER TABLE workflow_surface_nodes ADD CONSTRAINT workflow_surface_nodes_action_id_fkey FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE`.execute(db);
  await sql`ALTER TABLE workflow_surface_nodes ADD CONSTRAINT workflow_surface_nodes_parent_action_id_fkey FOREIGN KEY (parent_action_id) REFERENCES actions(id) ON DELETE CASCADE`.execute(db);
  await sql`ALTER TABLE hierarchy_nodes ADD CONSTRAINT hierarchy_nodes_default_record_def_id_fkey FOREIGN KEY (default_record_def_id) REFERENCES record_definitions(id) ON DELETE SET NULL`.execute(db);

  // ==========================================================================
  // INDEXES
  // ==========================================================================

  await db.schema
    .createIndex('idx_engagements_context')
    .on('engagements')
    .columns(['context_type', 'context_id'])
    .execute();

  await db.schema
    .createIndex('idx_engagements_kind')
    .on('engagements')
    .column('kind')
    .execute();

  await db.schema
    .createIndex('idx_definition_clone_excluded')
    .on('record_definitions')
    .column('clone_excluded')
    .execute();

  await db.schema
    .createIndex('idx_definition_templates')
    .on('record_definitions')
    .columns(['project_id', 'is_template'])
    .execute();

  await db.schema
    .createIndex('idx_record_definitions_definition_kind')
    .on('record_definitions')
    .column('definition_kind')
    .execute();

  await db.schema
    .createIndex('idx_record_definitions_derived')
    .on('record_definitions')
    .column('derived_from_id')
    .execute();

  await db.schema
    .createIndex('idx_users_deleted_at')
    .on('users')
    .column('deleted_at')
    .execute();

  await db.schema
    .createIndex('idx_users_role')
    .on('users')
    .column('role')
    .execute();

  await db.schema
    .createIndex('idx_workflow_surface_action')
    .on('workflow_surface_nodes')
    .column('action_id')
    .execute();

  await db.schema
    .createIndex('idx_workflow_surface_context')
    .on('workflow_surface_nodes')
    .columns(['context_id', 'context_type'])
    .execute();

  await db.schema
    .createIndex('idx_workflow_surface_tree')
    .on('workflow_surface_nodes')
    .columns(['surface_type', 'context_id', 'parent_action_id', 'position'])
    .execute();

  await db.schema
    .createIndex('idx_workflow_surface_unique')
    .on('workflow_surface_nodes')
    .columns(['surface_type', 'context_id', 'action_id'])
    .execute();

  await db.schema
    .createIndex('idx_intake_form_pages_form_page')
    .on('intake_form_pages')
    .columns(['form_id', 'page_index'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_intake_submissions_form_date')
    .on('intake_submissions')
    .columns(['form_id', 'created_at'])
    .execute();

  await db.schema
    .createIndex('idx_actions_context')
    .on('actions')
    .columns(['context_id', 'context_type'])
    .execute();

  await db.schema
    .createIndex('idx_actions_created')
    .on('actions')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_actions_definition_id')
    .on('actions')
    .column('definition_id')
    .execute();

  await db.schema
    .createIndex('idx_actions_parent')
    .on('actions')
    .column('parent_action_id')
    .execute();

  await db.schema
    .createIndex('idx_actions_type')
    .on('actions')
    .column('type')
    .execute();

  await db.schema
    .createIndex('idx_autohelper_commands_acknowledged')
    .on('autohelper_commands')
    .column('acknowledged_at')
    .execute();

  await db.schema
    .createIndex('idx_autohelper_commands_pending')
    .on('autohelper_commands')
    .columns(['user_id', 'status'])
    .execute();

  await db.schema
    .createIndex('idx_autohelper_instances_user_id')
    .on('autohelper_instances')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('connection_credentials_system_provider_idx')
    .on('connection_credentials')
    .column('provider')
    .execute();

  await db.schema
    .createIndex('connection_credentials_user_provider_idx')
    .on('connection_credentials')
    .columns(['user_id', 'provider'])
    .unique()
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

  await db.schema
    .createIndex('idx_export_sessions_status')
    .on('export_sessions')
    .column('status')
    .execute();

  await db.schema
    .createIndex('idx_fact_kind_definitions_needs_review')
    .on('fact_kind_definitions')
    .column('needs_review')
    .execute();

  await db.schema
    .createIndex('idx_hierarchy_parent')
    .on('hierarchy_nodes')
    .column('parent_id')
    .execute();

  await db.schema
    .createIndex('idx_hierarchy_parent_position')
    .on('hierarchy_nodes')
    .columns(['parent_id', 'position'])
    .execute();

  await db.schema
    .createIndex('idx_hierarchy_root')
    .on('hierarchy_nodes')
    .column('root_project_id')
    .execute();

  await db.schema
    .createIndex('idx_hierarchy_templates')
    .on('hierarchy_nodes')
    .column('is_template')
    .execute();

  await db.schema
    .createIndex('idx_hierarchy_type')
    .on('hierarchy_nodes')
    .column('type')
    .execute();

  await db.schema
    .createIndex('idx_sessions_expires')
    .on('sessions')
    .column('expires_at')
    .execute();

  await db.schema
    .createIndex('idx_sessions_user')
    .on('sessions')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('user_settings_user_key_idx')
    .on('user_settings')
    .columns(['user_id', 'setting_key'])
    .execute();

  await db.schema
    .createIndex('idx_events_action')
    .on('events')
    .column('action_id')
    .execute();

  await db.schema
    .createIndex('idx_events_action_time')
    .on('events')
    .columns(['action_id', 'occurred_at'])
    .execute();

  await db.schema
    .createIndex('idx_events_context')
    .on('events')
    .columns(['context_id', 'context_type'])
    .execute();

  await db.schema
    .createIndex('idx_events_occurred')
    .on('events')
    .column('occurred_at')
    .execute();

  await db.schema
    .createIndex('idx_events_type')
    .on('events')
    .column('type')
    .execute();

  await db.schema
    .createIndex('idx_import_sessions_created_by')
    .on('import_sessions')
    .column('created_by')
    .execute();

  await db.schema
    .createIndex('idx_import_sessions_status')
    .on('import_sessions')
    .column('status')
    .execute();

  await db.schema
    .createIndex('inference_learnings_project_idx')
    .on('inference_learnings')
    .column('project_id')
    .execute();

  await db.schema
    .createIndex('inference_learnings_source_type_idx')
    .on('inference_learnings')
    .column('source_type')
    .execute();

  await db.schema
    .createIndex('idx_mail_messages_project')
    .on('mail_messages')
    .column('project_id')
    .execute();

  await db.schema
    .createIndex('monday_workspaces_provider_account_idx')
    .on('monday_workspaces')
    .column('provider_account_id')
    .execute();

  await db.schema
    .createIndex('idx_polls_project')
    .on('polls')
    .column('project_id')
    .execute();

  await db.schema
    .createIndex('idx_project_members_project')
    .on('project_members')
    .column('project_id')
    .execute();

  await db.schema
    .createIndex('idx_project_members_user')
    .on('project_members')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_records_classification')
    .on('records')
    .column('classification_node_id')
    .execute();

  await db.schema
    .createIndex('idx_records_data')
    .on('records')
    .column('data')
    .execute();

  await db.schema
    .createIndex('idx_records_definition')
    .on('records')
    .column('definition_id')
    .execute();

  await db.schema
    .createIndex('idx_records_unique_name')
    .on('records')
    .column('unique_name')
    .execute();

  await db.schema
    .createIndex('idx_import_plans_session')
    .on('import_plans')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('idx_mail_links_message')
    .on('mail_links')
    .column('mail_message_id')
    .execute();

  await db.schema
    .createIndex('idx_mail_links_target')
    .on('mail_links')
    .columns(['target_type', 'target_id'])
    .execute();

  await db.schema
    .createIndex('external_source_mappings_local_entity_idx')
    .on('external_source_mappings')
    .column('local_entity_id')
    .execute();

  await db.schema
    .createIndex('external_source_mappings_provider_external_idx')
    .on('external_source_mappings')
    .columns(['provider', 'external_id'])
    .execute();

  await db.schema
    .createIndex('external_source_mappings_workspace_idx')
    .on('external_source_mappings')
    .column('workspace_id')
    .execute();

  await db.schema
    .createIndex('monday_board_configs_board_id_idx')
    .on('monday_board_configs')
    .column('board_id')
    .execute();

  await db.schema
    .createIndex('monday_board_configs_workspace_board_idx')
    .on('monday_board_configs')
    .columns(['workspace_id', 'board_id'])
    .execute();

  await db.schema
    .createIndex('idx_poll_responses_poll')
    .on('poll_responses')
    .column('poll_id')
    .execute();

  await db.schema
    .createIndex('idx_action_references_action_id')
    .on('action_references')
    .column('action_id')
    .execute();

  await db.schema
    .createIndex('idx_action_references_source_record_id')
    .on('action_references')
    .column('source_record_id')
    .execute();

  await db.schema
    .createIndex('idx_record_aliases_name')
    .on('record_aliases')
    .column('name')
    .execute();

  await db.schema
    .createIndex('idx_record_aliases_record_id')
    .on('record_aliases')
    .column('record_id')
    .execute();

  await db.schema
    .createIndex('idx_record_links_source')
    .on('record_links')
    .column('source_record_id')
    .execute();

  await db.schema
    .createIndex('idx_record_links_source_type')
    .on('record_links')
    .columns(['source_record_id', 'link_type'])
    .execute();

  await db.schema
    .createIndex('idx_record_links_target')
    .on('record_links')
    .column('target_record_id')
    .execute();

  await db.schema
    .createIndex('idx_record_links_type')
    .on('record_links')
    .column('link_type')
    .execute();

  await db.schema
    .createIndex('idx_import_executions_session')
    .on('import_executions')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('monday_column_configs_board_column_idx')
    .on('monday_column_configs')
    .columns(['board_config_id', 'column_id'])
    .execute();

  await db.schema
    .createIndex('monday_group_configs_board_group_idx')
    .on('monday_group_configs')
    .columns(['board_config_id', 'group_id'])
    .execute();

  await db.schema
    .createIndex('monday_sync_states_board_config_idx')
    .on('monday_sync_states')
    .column('board_config_id')
    .execute();

}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop tables with CASCADE to handle foreign key dependencies
  await db.schema.dropTable('monday_sync_states').ifExists().cascade().execute();
  await db.schema.dropTable('monday_group_configs').ifExists().cascade().execute();
  await db.schema.dropTable('monday_column_configs').ifExists().cascade().execute();
  await db.schema.dropTable('import_executions').ifExists().cascade().execute();
  await db.schema.dropTable('record_links').ifExists().cascade().execute();
  await db.schema.dropTable('record_aliases').ifExists().cascade().execute();
  await db.schema.dropTable('action_references').ifExists().cascade().execute();
  await db.schema.dropTable('poll_responses').ifExists().cascade().execute();
  await db.schema.dropTable('monday_board_configs').ifExists().cascade().execute();
  await db.schema.dropTable('external_source_mappings').ifExists().cascade().execute();
  await db.schema.dropTable('mail_links').ifExists().cascade().execute();
  await db.schema.dropTable('import_plans').ifExists().cascade().execute();
  await db.schema.dropTable('records').ifExists().cascade().execute();
  await db.schema.dropTable('project_members').ifExists().cascade().execute();
  await db.schema.dropTable('polls').ifExists().cascade().execute();
  await db.schema.dropTable('monday_workspaces').ifExists().cascade().execute();
  await db.schema.dropTable('mail_messages').ifExists().cascade().execute();
  await db.schema.dropTable('inference_learnings').ifExists().cascade().execute();
  await db.schema.dropTable('import_sessions').ifExists().cascade().execute();
  await db.schema.dropTable('events').ifExists().cascade().execute();
  await db.schema.dropTable('user_settings').ifExists().cascade().execute();
  await db.schema.dropTable('sessions').ifExists().cascade().execute();
  await db.schema.dropTable('hierarchy_nodes').ifExists().cascade().execute();
  await db.schema.dropTable('fact_kind_definitions').ifExists().cascade().execute();
  await db.schema.dropTable('export_sessions').ifExists().cascade().execute();
  await db.schema.dropTable('connection_credentials').ifExists().cascade().execute();
  await db.schema.dropTable('autohelper_instances').ifExists().cascade().execute();
  await db.schema.dropTable('autohelper_commands').ifExists().cascade().execute();
  await db.schema.dropTable('actions').ifExists().cascade().execute();
  await db.schema.dropTable('intake_submissions').ifExists().cascade().execute();
  await db.schema.dropTable('intake_form_pages').ifExists().cascade().execute();
  await db.schema.dropTable('workflow_surface_nodes').ifExists().cascade().execute();
  await db.schema.dropTable('users').ifExists().cascade().execute();
  await db.schema.dropTable('record_definitions').ifExists().cascade().execute();
  await db.schema.dropTable('intake_forms').ifExists().cascade().execute();
  await db.schema.dropTable('engagements').ifExists().cascade().execute();

  // Drop enums
  await sql`DROP TYPE IF EXISTS context_type CASCADE`.execute(db);
  await sql`DROP TYPE IF EXISTS intake_form_status CASCADE`.execute(db);
  await sql`DROP TYPE IF EXISTS node_type CASCADE`.execute(db);
  await sql`DROP TYPE IF EXISTS poll_status CASCADE`.execute(db);
  await sql`DROP TYPE IF EXISTS ref_mode CASCADE`.execute(db);
}
