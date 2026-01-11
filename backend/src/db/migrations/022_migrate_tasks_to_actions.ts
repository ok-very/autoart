/**
 * Migration 022: Task Migration (DEPRECATED - No-Op)
 *
 * This migration previously converted legacy task/subtask hierarchy nodes
 * into the foundational model (Actions + Events).
 *
 * As of 2026-01-04, this migration is now a no-op because:
 * - We are on a fresh-start experimental branch
 * - Container actions (Process/Stage/Subprocess) are now action-based
 * - Legacy task migration is no longer needed
 *
 * The migration file is retained for migration history compatibility.
 */

import { Kysely } from 'kysely';

export async function up(_db: Kysely<unknown>): Promise<void> {
  console.log('  ℹ Migration 022 is now a no-op (fresh start architecture)');
  console.log('  → Container actions created via seed data instead');
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  console.log('  ℹ Migration 022 down is a no-op');
}
