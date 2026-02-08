import { Kysely, sql } from 'kysely';

/**
 * Migration 005: Import-Action Links
 *
 * Creates the import_action_links table for tracking which actions
 * were created from which import session items. Supports both
 * auto-linking during execution and manual linking via API.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('import_action_links')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('import_session_id', 'uuid', (col) =>
      col.notNull().references('import_sessions.id').onDelete('cascade')
    )
    .addColumn('item_temp_id', 'text', (col) => col.notNull())
    .addColumn('action_id', 'uuid', (col) =>
      col.notNull().references('actions.id').onDelete('cascade')
    )
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`CREATE UNIQUE INDEX idx_import_action_links_unique ON import_action_links(import_session_id, item_temp_id, action_id)`.execute(db);
  await sql`CREATE INDEX idx_import_action_links_action ON import_action_links(action_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_import_action_links_action`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_import_action_links_unique`.execute(db);
  await db.schema.dropTable('import_action_links').execute();
}
