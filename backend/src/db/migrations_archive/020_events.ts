/**
 * Migration 020: Events Table (Immutable Fact Log)
 *
 * Events record what occurred, never what is. They are the source of truth
 * for deriving any state or status through interpretation.
 *
 * Design decisions:
 * - Append-only: NO UPDATE, NO DELETE operations allowed
 * - context_id + context_type mirrors Actions for consistent scoping
 * - action_id is nullable - some events aren't tied to specific actions
 * - payload is JSONB for flexible event-specific data
 * - occurred_at uses TIMESTAMPTZ for accurate chronological ordering
 *
 * Event naming uses fact-based semantics (not state-based):
 * - ACTION_DECLARED (not ACTION_CREATED)
 * - WORK_FINISHED (not ACTION_COMPLETED)
 * - FIELD_VALUE_RECORDED (not FIELD_UPDATED)
 *
 * Core event types (Initial Catalog):
 * - ACTION_DECLARED: An action was created
 * - WORK_STARTED: Work began on an action
 * - WORK_STOPPED: Work paused on an action
 * - WORK_FINISHED: Work completed on an action
 * - WORK_BLOCKED: Action became blocked
 * - WORK_UNBLOCKED: Blockage was resolved
 * - FIELD_VALUE_RECORDED: A field value was captured
 * - ASSIGNMENT_OCCURRED: Someone was assigned
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Events table - immutable fact log
  await db.schema
    .createTable('events')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('context_id', 'uuid', (col) => col.notNull())
    .addColumn('context_type', sql`context_type`, (col) => col.notNull())
    .addColumn('action_id', 'uuid', (col) =>
      col.references('actions.id').onDelete('cascade')
    )
    .addColumn('type', 'varchar(100)', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('actor_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('occurred_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index for context-scoped event queries
  await db.schema
    .createIndex('idx_events_context')
    .on('events')
    .columns(['context_id', 'context_type'])
    .execute();

  // Index for action-specific event history
  await db.schema
    .createIndex('idx_events_action')
    .on('events')
    .column('action_id')
    .execute();

  // Index for event type filtering
  await db.schema
    .createIndex('idx_events_type')
    .on('events')
    .column('type')
    .execute();

  // Index for chronological queries (critical for interpretation)
  await db.schema
    .createIndex('idx_events_occurred')
    .on('events')
    .column('occurred_at')
    .execute();

  // Composite index for interpreting action state (action + time order)
  await db.schema
    .createIndex('idx_events_action_time')
    .on('events')
    .columns(['action_id', 'occurred_at'])
    .execute();

  // Prevent UPDATE and DELETE on events table via trigger
  // This enforces the append-only immutability constraint
  await sql`
    CREATE OR REPLACE FUNCTION prevent_event_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Events table is append-only. UPDATE and DELETE operations are forbidden.';
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    CREATE TRIGGER events_immutable_update
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_event_mutation();
  `.execute(db);

  await sql`
    CREATE TRIGGER events_immutable_delete
    BEFORE DELETE ON events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_event_mutation();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS events_immutable_delete ON events`.execute(db);
  await sql`DROP TRIGGER IF EXISTS events_immutable_update ON events`.execute(db);
  await sql`DROP FUNCTION IF EXISTS prevent_event_mutation()`.execute(db);
  await db.schema.dropTable('events').ifExists().execute();
}
