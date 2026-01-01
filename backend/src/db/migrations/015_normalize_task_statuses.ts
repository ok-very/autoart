/**
 * Migration 015: Normalize Legacy Task Status Values
 *
 * Permanently rewrites any legacy task metadata.status values into the new enum.
 *
 * This eliminates reliance on runtime "legacy" parsing logic.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Some historical environments stored JSON into JSONB as a JSON string.
    // If so, convert those rows to proper JSON objects first.
    await db.executeQuery(
        sql`
      update hierarchy_nodes
      set metadata = trim(both '"' from metadata::text)::jsonb
      where type = 'task'
        and metadata is not null
        and jsonb_typeof(metadata) = 'string'
        and left(metadata::text, 2) = '"{'
    `.compile(db)
    );

    // Normalize legacy status values.
    await db.executeQuery(
        sql`
      update hierarchy_nodes
      set metadata = jsonb_set(metadata, '{status}', '"in-progress"', true)
      where type = 'task'
        and metadata is not null
        and metadata->>'status' = 'working'
    `.compile(db)
    );

    await db.executeQuery(
        sql`
      update hierarchy_nodes
      set metadata = jsonb_set(metadata, '{status}', '"blocked"', true)
      where type = 'task'
        and metadata is not null
        and metadata->>'status' = 'stuck'
    `.compile(db)
    );
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Best-effort rollback to legacy values.
    await db.executeQuery(
        sql`
      update hierarchy_nodes
      set metadata = jsonb_set(metadata, '{status}', '"working"', true)
      where type = 'task'
        and metadata is not null
        and metadata->>'status' = 'in-progress'
    `.compile(db)
    );

    await db.executeQuery(
        sql`
      update hierarchy_nodes
      set metadata = jsonb_set(metadata, '{status}', '"stuck"', true)
      where type = 'task'
        and metadata is not null
        and metadata->>'status' = 'blocked'
    `.compile(db)
    );
}
