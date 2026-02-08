import { Kysely, sql } from 'kysely';

/**
 * Migration 004: Action Vocabulary
 *
 * Creates the action_vocabulary table for learning verbs/nouns/adjectives
 * from interpreted import items. Supports autocomplete suggestions and
 * frequency-based ranking.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('action_vocabulary')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('verb', 'text', (col) => col.notNull())
    .addColumn('noun', 'text', (col) => col.notNull())
    .addColumn('adjective', 'text')
    .addColumn('classification_outcome', 'text', (col) => col.notNull())
    .addColumn('frequency', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('last_seen_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('uq_action_vocabulary_verb_noun_adjective', ['verb', 'noun', 'adjective'])
    .execute();

  await sql`CREATE INDEX idx_action_vocabulary_verb_noun ON action_vocabulary(verb, noun)`.execute(db);
  await sql`CREATE INDEX idx_action_vocabulary_frequency ON action_vocabulary(frequency DESC)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_action_vocabulary_frequency`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_action_vocabulary_verb_noun`.execute(db);
  await db.schema.dropTable('action_vocabulary').execute();
}
