/**
 * Migration 054: AutoHelper Instances & Commands
 *
 * Creates tables for the AutoHelper settings bridge:
 * - autohelper_instances: Settings + cached status per user
 * - autohelper_commands: Command queue for async execution
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Settings + status per user (single AutoHelper per account)
  await db.schema
    .createTable('autohelper_instances')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').unique()
    )
    .addColumn('settings', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('settings_version', 'integer', (col) =>
      col.notNull().defaultTo(1)
    )
    .addColumn('status', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('last_seen', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index for user lookup
  await db.schema
    .createIndex('idx_autohelper_instances_user_id')
    .on('autohelper_instances')
    .column('user_id')
    .execute();

  // Command queue (ephemeral, cleaned after ack)
  await db.schema
    .createTable('autohelper_commands')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id')
    )
    .addColumn('command_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().defaultTo('pending')
    )
    .addColumn('result', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addColumn('acknowledged_at', 'timestamptz')
    .execute();

  // Index for efficient pending command lookup
  await sql`
    CREATE INDEX idx_autohelper_commands_pending
    ON autohelper_commands(user_id, status)
    WHERE status = 'pending'
  `.execute(db);

  // Index for cleanup of old acknowledged commands
  await db.schema
    .createIndex('idx_autohelper_commands_acknowledged')
    .on('autohelper_commands')
    .column('acknowledged_at')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('autohelper_commands').execute();
  await db.schema.dropTable('autohelper_instances').execute();
}
