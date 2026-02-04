/**
 * Migration 003: Users & Sessions
 *
 * Core authentication tables.
 *
 * Design decisions:
 * - UUIDs for primary keys (no sequential exposure, merge-safe)
 * - Email stored lowercase (enforced at application layer)
 * - Password hash uses bcrypt (handled by application)
 * - Sessions support refresh token rotation
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Users table
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Sessions table - stores refresh tokens for JWT rotation
  await db.schema
    .createTable('sessions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('refresh_token', 'text', (col) => col.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index for efficient session lookup by user
  await db.schema
    .createIndex('idx_sessions_user')
    .on('sessions')
    .column('user_id')
    .execute();

  // Index for expired session cleanup
  await db.schema
    .createIndex('idx_sessions_expires')
    .on('sessions')
    .column('expires_at')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sessions').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}
