/**
 * Migration 050: Add avatar_url to users
 *
 * Nullable text column for user profile avatar URLs.
 * Populated when a user uploads an avatar image.
 */

import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable('users')
        .addColumn('avatar_url', 'text')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable('users')
        .dropColumn('avatar_url')
        .execute();
}
