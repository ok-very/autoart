/**
 * Migration 046: Engagements Table
 *
 * General-purpose engagement tracking for forms, polls, and pages.
 * Tracks user interactions like OPENED, INTERACTED, and DEFERRED events.
 *
 * @see https://github.com/ok-very/autoart/issues/193
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // engagements table
  // Note: context_type uses different values ('poll', 'form', 'page') than the
  // existing context_type enum ('subprocess', 'stage', etc.), so we use text.
  // context_id is text because poll unique_ids are slugs, not UUIDs.
  await db.schema
    .createTable('engagements')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('context_type', 'text', (col) => col.notNull())
    .addColumn('context_id', 'text', (col) => col.notNull())
    .addColumn('actor_name', 'text')
    .addColumn('payload', 'jsonb')
    .addColumn('occurred_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index for querying engagements by context
  await db.schema
    .createIndex('idx_engagements_context')
    .on('engagements')
    .columns(['context_type', 'context_id'])
    .execute();

  // Index for querying engagements by kind
  await db.schema
    .createIndex('idx_engagements_kind')
    .on('engagements')
    .column('kind')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('engagements').ifExists().execute();
}
