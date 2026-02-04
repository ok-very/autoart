/**
 * Migration 008: Database Functions
 *
 * PostgreSQL functions for common operations that benefit from
 * being executed within the database engine.
 *
 * Functions defined:
 * - update_updated_at(): Trigger function for automatic timestamp updates
 * - get_subtree(): Returns all descendants of a node (for cloning)
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Function to automatically update updated_at timestamp
  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  // Apply updated_at trigger to relevant tables
  await sql`
    CREATE TRIGGER trg_hierarchy_nodes_updated_at
    BEFORE UPDATE ON hierarchy_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at()
  `.execute(db);

  await sql`
    CREATE TRIGGER trg_records_updated_at
    BEFORE UPDATE ON records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at()
  `.execute(db);

  // Function to get entire subtree of a node (used for cloning)
  // Returns all descendants including the starting node
  await sql`
    CREATE OR REPLACE FUNCTION get_subtree(start_node_id UUID)
    RETURNS TABLE (
      id UUID,
      parent_id UUID,
      root_project_id UUID,
      node_type node_type,
      title TEXT,
      description JSONB,
      node_position INTEGER,
      default_record_def_id UUID,
      metadata JSONB,
      is_template BOOLEAN,
      created_by UUID,
      depth INTEGER
    ) AS $$
    BEGIN
      RETURN QUERY
      WITH RECURSIVE tree AS (
        SELECT
          h.id, h.parent_id, h.root_project_id, h.type, h.title,
          h.description, h."position", h.default_record_def_id,
          h.metadata, h.is_template, h.created_by,
          0 AS depth
        FROM hierarchy_nodes h
        WHERE h.id = start_node_id

        UNION ALL

        SELECT
          h.id, h.parent_id, h.root_project_id, h.type, h.title,
          h.description, h."position", h.default_record_def_id,
          h.metadata, h.is_template, h.created_by,
          t.depth + 1
        FROM hierarchy_nodes h
        INNER JOIN tree t ON h.parent_id = t.id
      )
      SELECT * FROM tree ORDER BY depth, tree."position";
    END;
    $$ LANGUAGE plpgsql STABLE
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS trg_records_updated_at ON records`.execute(db);
  await sql`DROP TRIGGER IF EXISTS trg_hierarchy_nodes_updated_at ON hierarchy_nodes`.execute(db);
  await sql`DROP FUNCTION IF EXISTS get_subtree(UUID)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS update_updated_at()`.execute(db);
}
