/**
 * Migration 031: Add needs_review status to import_sessions
 *
 * The import workflow now has a 'needs_review' status for sessions
 * that have unresolved classifications (AMBIGUOUS/UNCLASSIFIED).
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Drop old check constraint and add new one with needs_review
    await sql`
        ALTER TABLE import_sessions
        DROP CONSTRAINT IF EXISTS import_sessions_status_check;
    `.execute(db);

    await sql`
        ALTER TABLE import_sessions
        ADD CONSTRAINT import_sessions_status_check
        CHECK (status IN ('pending', 'planned', 'needs_review', 'executing', 'completed', 'failed'));
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Revert to original constraint (would fail if any needs_review rows exist)
    await sql`
        ALTER TABLE import_sessions
        DROP CONSTRAINT IF EXISTS import_sessions_status_check;
    `.execute(db);

    await sql`
        ALTER TABLE import_sessions
        ADD CONSTRAINT import_sessions_status_check
        CHECK (status IN ('pending', 'planned', 'executing', 'completed', 'failed'));
    `.execute(db);
}
