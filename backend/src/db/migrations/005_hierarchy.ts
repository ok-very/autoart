/**
 * Migration 005: Hierarchy Nodes
 *
 * The core tree structure using Adjacency List pattern.
 * Supports 5 levels: Project → Process → Stage → Subprocess → Task
 *
 * Design decisions:
 * - Adjacency List chosen over Closure Table for O(N) cloning performance
 * - root_project_id denormalized for efficient project-scoped queries
 * - description is JSONB to support TipTap rich text format
 * - metadata is JSONB for flexible, type-specific properties
 * - position enables explicit ordering within parent
 *
 * Hierarchy rules (enforced at application layer):
 * - project: no parent (root)
 * - process: parent must be project
 * - stage: parent must be process
 * - subprocess: parent must be stage
 * - task: parent must be subprocess
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('hierarchy_nodes')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('parent_id', 'uuid', (col) =>
      col.references('hierarchy_nodes.id').onDelete('cascade')
    )
    .addColumn('root_project_id', 'uuid', (col) =>
      col.references('hierarchy_nodes.id').onDelete('cascade')
    )
    .addColumn('type', sql`node_type`, (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'jsonb')
    .addColumn('position', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('default_record_def_id', 'uuid', (col) =>
      col.references('record_definitions.id').onDelete('set null')
    )
    .addColumn('metadata', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('is_template', 'boolean', (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn('created_by', 'uuid', (col) =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index for tree traversal (finding children)
  await db.schema
    .createIndex('idx_hierarchy_parent')
    .on('hierarchy_nodes')
    .column('parent_id')
    .execute();

  // Index for project-scoped queries
  await db.schema
    .createIndex('idx_hierarchy_root')
    .on('hierarchy_nodes')
    .column('root_project_id')
    .execute();

  // Index for filtering by node type
  await db.schema
    .createIndex('idx_hierarchy_type')
    .on('hierarchy_nodes')
    .column('type')
    .execute();

  // Composite index for ordered children queries
  await db.schema
    .createIndex('idx_hierarchy_parent_position')
    .on('hierarchy_nodes')
    .columns(['parent_id', 'position'])
    .execute();

  // Index for template lookup
  await db.schema
    .createIndex('idx_hierarchy_templates')
    .on('hierarchy_nodes')
    .column('is_template')
    .where('is_template', '=', true)
    .execute();

  // Add FK constraint for record_definitions.project_id -> hierarchy_nodes.id
  // This must be done after hierarchy_nodes table exists
  await sql`
    ALTER TABLE record_definitions
    ADD CONSTRAINT record_definitions_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES hierarchy_nodes(id) ON DELETE CASCADE
  `.execute(db);

  // Partial index for efficient template lookups by project
  await db.schema
    .createIndex('idx_definition_templates')
    .on('record_definitions')
    .columns(['project_id', 'is_template'])
    .where(sql.ref('is_template'), '=', true)
    .execute();

  // Index for clone exclusion lookups
  await db.schema
    .createIndex('idx_definition_clone_excluded')
    .on('record_definitions')
    .column('clone_excluded')
    .where(sql.ref('clone_excluded'), '=', true)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop indexes and FK on record_definitions first
  await db.schema.dropIndex('idx_definition_clone_excluded').ifExists().execute();
  await db.schema.dropIndex('idx_definition_templates').ifExists().execute();
  await sql`
    ALTER TABLE record_definitions DROP CONSTRAINT IF EXISTS record_definitions_project_id_fkey
  `.execute(db);

  await db.schema.dropTable('hierarchy_nodes').ifExists().execute();
}
