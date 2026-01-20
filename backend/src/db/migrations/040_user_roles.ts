/**
 * Migration 040: User Roles
 *
 * Adds a 'role' column to the users table for basic RBAC.
 * Default role is 'user'. Other roles: 'admin', 'viewer'.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Add role column with default 'user'
    await db.schema
        .alterTable('users')
        .addColumn('role', 'text', (col) => col.notNull().defaultTo('user'))
        .execute();

    // Add index for role-based queries
    await db.schema
        .createIndex('idx_users_role')
        .on('users')
        .column('role')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .dropIndex('idx_users_role')
        .ifExists()
        .execute();

    await db.schema
        .alterTable('users')
        .dropColumn('role')
        .execute();
}
