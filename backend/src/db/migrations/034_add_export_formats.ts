/**
 * Migration 034: Add Google Sheets/Slides Export Formats
 *
 * Updates the CHECK constraint on export_sessions.format to include
 * the google-sheets and google-slides formats which were added to
 * the service layer but not originally in the database constraint.
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Drop existing constraint and add updated one with all 7 formats
    await sql`
        ALTER TABLE export_sessions 
        DROP CONSTRAINT IF EXISTS export_sessions_format_check;
    `.execute(db);

    await sql`
        ALTER TABLE export_sessions 
        ADD CONSTRAINT export_sessions_format_check 
        CHECK (format IN ('rtf', 'markdown', 'plaintext', 'csv', 'google-doc', 'google-sheets', 'google-slides'));
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Restore original constraint (without google-sheets, google-slides)
    await sql`
        ALTER TABLE export_sessions 
        DROP CONSTRAINT IF EXISTS export_sessions_format_check;
    `.execute(db);

    await sql`
        ALTER TABLE export_sessions 
        ADD CONSTRAINT export_sessions_format_check 
        CHECK (format IN ('rtf', 'markdown', 'plaintext', 'csv', 'google-doc'));
    `.execute(db);
}
