import { Kysely, sql } from 'kysely';

/**
 * Migration 008: Create sync_decisions table
 *
 * Persists user decisions on field-level changes from BFA sync diff reports.
 * Supports multi-user review, assignment flagging, and applied-at tracking.
 * Reusable pattern for future review workflows beyond BFA sync.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE sync_decisions (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_config_id uuid NOT NULL REFERENCES monday_board_configs(id) ON DELETE CASCADE,
      report_id       uuid NOT NULL,
      entity_id       uuid NOT NULL,
      field           text NOT NULL,
      source_field    text NOT NULL,
      old_value       text NOT NULL,
      new_value       text NOT NULL,
      authority       text NOT NULL,
      severity        text NOT NULL,
      decision        text,
      decided_by      uuid REFERENCES users(id),
      decided_at      timestamptz,
      assigned_to     uuid REFERENCES users(id),
      applied_at      timestamptz,
      created_at      timestamptz NOT NULL DEFAULT now(),
      UNIQUE(report_id, entity_id, field)
    )
  `.execute(db);

  await sql`CREATE INDEX idx_sync_decisions_board ON sync_decisions(board_config_id)`.execute(db);
  await sql`CREATE INDEX idx_sync_decisions_report ON sync_decisions(report_id)`.execute(db);
  await sql`CREATE INDEX idx_sync_decisions_assigned ON sync_decisions(assigned_to) WHERE assigned_to IS NOT NULL`.execute(db);
  await sql`CREATE INDEX idx_sync_decisions_pending ON sync_decisions(board_config_id) WHERE decision IS NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS sync_decisions`.execute(db);
}
