/**
 * Migration 056: Poll Confirmation Message
 *
 * Adds confirmation_message column to polls table.
 * This message is displayed to respondents after they submit their availability.
 */

import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('polls')
    .addColumn('confirmation_message', 'text')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('polls')
    .dropColumn('confirmation_message')
    .execute();
}
