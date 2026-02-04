/**
 * Migration 053: Add body_html to mail_messages
 *
 * Stores the full HTML body of promoted emails. Can be large (10-100KB),
 * stored as TEXT without truncation to support faithful rendering.
 */

import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable('mail_messages')
        .addColumn('body_html', 'text')
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable('mail_messages')
        .dropColumn('body_html')
        .execute();
}
