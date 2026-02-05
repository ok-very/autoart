import { Kysely, sql } from 'kysely';

/**
 * Migration 003: Add hierarchy association to intake forms
 *
 * Adds project_id and classification_node_id to intake_forms so forms
 * can be associated with a project and a specific hierarchy node where
 * submissions land (process/stage/subprocess).
 *
 * Both columns are nullable - forms without project association still
 * work for metadata-only submissions.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE intake_forms
      ADD COLUMN project_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
      ADD COLUMN classification_node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL
  `.execute(db);

  await sql`
    CREATE INDEX idx_intake_forms_project ON intake_forms(project_id)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_intake_forms_project`.execute(db);

  await sql`
    ALTER TABLE intake_forms
      DROP COLUMN IF EXISTS classification_node_id,
      DROP COLUMN IF EXISTS project_id
  `.execute(db);
}
