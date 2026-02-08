/**
 * Migration 009: Rename hierarchy node type 'stage' → 'phase'
 *
 * Renames the 'stage' value in both the node_type and context_type PostgreSQL
 * enums. ALTER TYPE ... RENAME VALUE is an in-place operation — no data
 * migration needed. All existing rows with type='stage' become type='phase'.
 */

import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`ALTER TYPE node_type RENAME VALUE 'stage' TO 'phase'`.execute(db);
    await sql`ALTER TYPE context_type RENAME VALUE 'stage' TO 'phase'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`ALTER TYPE node_type RENAME VALUE 'phase' TO 'stage'`.execute(db);
    await sql`ALTER TYPE context_type RENAME VALUE 'phase' TO 'stage'`.execute(db);
}
