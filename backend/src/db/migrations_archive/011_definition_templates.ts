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
  // Add project_id column - nullable for global definitions.
  // Use raw SQL so it is safe to run on DBs where the column already exists.
  await db.executeQuery(
    sql`
      alter table record_definitions
      add column if not exists project_id uuid
      references hierarchy_nodes(id)
      on delete cascade
    `.compile(db)
  );

  // Add is_template flag (safe if already exists)
  await db.executeQuery(
    sql`
      alter table record_definitions
      add column if not exists is_template boolean not null default false
    `.compile(db)
  );

  // Partial index for efficient template lookups by project
  await db.executeQuery(
    sql`
      create index if not exists idx_definition_templates
      on record_definitions (project_id, is_template)
      where is_template = true
    `.compile(db)
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.executeQuery(
    sql`drop index if exists idx_definition_templates`.compile(db)
  );

  await db.executeQuery(
    sql`alter table record_definitions drop column if exists is_template`.compile(db)
  );

  await db.executeQuery(
    sql`alter table record_definitions drop column if exists project_id`.compile(db)
  );
}
