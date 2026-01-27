/**
 * Migration 045: Polls Tables
 *
 * Creates database schema for time-slot polling (like Doodle/When2Meet).
 *
 * Tables:
 * - polls: Parent poll entity with unique_id for public URLs
 * - poll_responses: Participant availability responses
 *
 * @see https://github.com/ok-very/autoart/issues/XXX
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.transaction().execute(async (trx) => {
    // Poll status enum
    await sql`
      CREATE TYPE poll_status AS ENUM ('active', 'closed', 'draft')
    `.execute(trx);

    // polls table
    await trx.schema
      .createTable('polls')
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('unique_id', 'text', (col) => col.notNull().unique())
      .addColumn('title', 'text', (col) => col.notNull())
      .addColumn('description', 'text')
      .addColumn('status', sql`poll_status`, (col) =>
        col.notNull().defaultTo('active')
      )
      .addColumn('time_config', 'jsonb', (col) => col.notNull())
      .addColumn('project_id', 'uuid', (col) =>
        col.references('hierarchy_nodes.id').onDelete('set null')
      )
      .addColumn('created_by', 'uuid', (col) =>
        col.references('users.id').onDelete('set null')
      )
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`NOW()`)
      )
      .addColumn('closed_at', 'timestamptz')
      .execute();

    // poll_responses table
    await trx.schema
      .createTable('poll_responses')
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('poll_id', 'uuid', (col) =>
        col.notNull().references('polls.id').onDelete('cascade')
      )
      .addColumn('participant_name', 'text', (col) => col.notNull())
      .addColumn('participant_email', 'text')
      .addColumn('available_slots', 'jsonb', (col) =>
        col.notNull().defaultTo(sql`'[]'::jsonb`)
      )
      .addColumn('user_id', 'uuid', (col) =>
        col.references('users.id').onDelete('set null')
      )
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`NOW()`)
      )
      .addColumn('updated_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`NOW()`)
      )
      .addUniqueConstraint('poll_responses_poll_participant_unique', [
        'poll_id',
        'participant_name',
      ])
      .execute();

    // Index for fetching responses by poll
    await trx.schema
      .createIndex('idx_poll_responses_poll')
      .on('poll_responses')
      .column('poll_id')
      .execute();

    // Partial index for polls with project association
    await sql`
      CREATE INDEX idx_polls_project ON polls(project_id) WHERE project_id IS NOT NULL
    `.execute(trx);
  });
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('poll_responses').ifExists().execute();
  await db.schema.dropTable('polls').ifExists().execute();
  await sql`DROP TYPE IF EXISTS poll_status`.execute(db);
}
