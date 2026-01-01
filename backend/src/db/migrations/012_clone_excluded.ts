/**
 * Migration 012: Clone Excluded Flag
 *
 * Changes the cloning model from opt-in (templates) to opt-out (exclusions).
 * - clone_excluded: When true, definition will NOT be cloned when cloning a project
 *
 * All definitions are now cloned by default unless explicitly excluded.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add clone_excluded flag - defaults to false (included in clones).
  // Use raw SQL so it is safe to run on DBs where the column already exists.
  await db.executeQuery(
    sql`
      alter table record_definitions
      add column if not exists clone_excluded boolean not null default false
    `.compile(db)
  );

  // Index for efficient exclusion lookups
  await db.executeQuery(
    sql`
      create index if not exists idx_definition_clone_excluded
      on record_definitions (clone_excluded)
      where clone_excluded = true
    `.compile(db)
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.executeQuery(
    sql`drop index if exists idx_definition_clone_excluded`.compile(db)
  );

  await db.executeQuery(
    sql`alter table record_definitions drop column if exists clone_excluded`.compile(db)
  );
}
