/**
 * Migration 030: Users Soft Delete
 *
 * Adds soft delete capability to users table.
 * - deleted_at: timestamp when user was soft-deleted
 * - deleted_by: reference to admin who performed the deletion
 *
 * Design decisions:
 * - Soft delete preserves historical references (actor_id in events)
 * - deleted_by allows audit trail of who deleted whom
 * - Index on deleted_at for efficient "active users" queries
 */

import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Add soft delete columns to users table
    await db.schema
        .alterTable('users')
        .addColumn('deleted_at', 'timestamptz')
        .execute();

    await db.schema
        .alterTable('users')
        .addColumn('deleted_by', 'uuid', (col) =>
            col.references('users.id').onDelete('set null')
        )
        .execute();

    // Index for efficient active user queries
    await db.schema
        .createIndex('idx_users_deleted_at')
        .on('users')
        .column('deleted_at')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .dropIndex('idx_users_deleted_at')
        .ifExists()
        .execute();

    await db.schema
        .alterTable('users')
        .dropColumn('deleted_by')
        .execute();

    await db.schema
        .alterTable('users')
        .dropColumn('deleted_at')
        .execute();
}
