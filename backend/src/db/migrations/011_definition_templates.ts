/**
 * Migration 011: Definition Templates
 *
 * Adds project-scoped template functionality to record definitions.
 * - project_id: Links a definition to a specific project's library
 * - is_template: Marks definition as a reusable template
 *
 * When cloning a project, templates can be optionally cloned.
 * Global definitions (project_id = null) remain shared across all projects.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add project_id column - nullable for global definitions
  await db.schema
    .alterTable('record_definitions')
    .addColumn('project_id', 'uuid', (col) =>
      col.references('hierarchy_nodes.id').onDelete('cascade')
    )
    .execute();

  // Add is_template flag
  await db.schema
    .alterTable('record_definitions')
    .addColumn('is_template', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  // Partial index for efficient template lookups by project
  await db.schema
    .createIndex('idx_definition_templates')
    .on('record_definitions')
    .columns(['project_id', 'is_template'])
    .where(sql.ref('is_template'), '=', true)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('idx_definition_templates')
    .ifExists()
    .execute();

  await db.schema
    .alterTable('record_definitions')
    .dropColumn('is_template')
    .execute();

  await db.schema
    .alterTable('record_definitions')
    .dropColumn('project_id')
    .execute();
}
