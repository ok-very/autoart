/**
 * Migration 002: Custom ENUM Types
 *
 * Defines all custom PostgreSQL ENUM types used throughout the schema.
 * ENUMs provide type safety at the database level and are more efficient
 * than CHECK constraints for fixed value sets.
 *
 * Types defined:
 * - node_type: Hierarchy levels (project → process → stage → subprocess → task)
 * - ref_mode: Reference behavior (static snapshots vs dynamic links)
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Node type enum - represents the 5-level hierarchy
  // Order matters: project is root, task is leaf
  await sql`
    CREATE TYPE node_type AS ENUM (
      'project',
      'process',
      'stage',
      'subprocess',
      'task'
    )
  `.execute(db);

  // Reference mode enum - controls how task references behave
  // static: snapshot value at creation, editable independently
  // dynamic: live link to source record, updates automatically
  await sql`
    CREATE TYPE ref_mode AS ENUM (
      'static',
      'dynamic'
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TYPE IF EXISTS ref_mode`.execute(db);
  await sql`DROP TYPE IF EXISTS node_type`.execute(db);
}
