/**
 * Migration 014: Pinned Flag for Record Definitions
 *
 * Adds a `pinned` boolean flag to record_definitions.
 * - pinned: When true, definition appears in quick create menu in hierarchy sidebar
 *
 * Defaults to false (not pinned).
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add pinned flag - defaults to false (safe if already exists)
  await db.executeQuery(
    sql`
      alter table record_definitions
      add column if not exists pinned boolean not null default false
    `.compile(db)
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.executeQuery(
    sql`alter table record_definitions drop column if exists pinned`.compile(db)
  );
}
