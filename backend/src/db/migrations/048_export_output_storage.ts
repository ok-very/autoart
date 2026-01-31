/**
 * Migration 048: Export Output Storage
 *
 * Expands the export_sessions format CHECK constraint to include
 * 'pdf' and 'docx' formats, and adds columns for storing
 * generated output files (path + MIME type).
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Drop existing constraint and add updated one with all 9 formats
    await sql`
        ALTER TABLE export_sessions
        DROP CONSTRAINT IF EXISTS export_sessions_format_check;
    `.execute(db);

    await sql`
        ALTER TABLE export_sessions
        ADD CONSTRAINT export_sessions_format_check
        CHECK (format IN (
            'rtf', 'markdown', 'plaintext', 'csv',
            'google-doc', 'google-sheets', 'google-slides',
            'pdf', 'docx'
        ));
    `.execute(db);

    // Add output storage columns
    await sql`
        ALTER TABLE export_sessions
        ADD COLUMN output_path TEXT,
        ADD COLUMN output_mime_type TEXT;
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Remove output storage columns
    await sql`
        ALTER TABLE export_sessions
        DROP COLUMN IF EXISTS output_path,
        DROP COLUMN IF EXISTS output_mime_type;
    `.execute(db);

    // Remove sessions with formats that the narrower constraint won't allow
    await sql`
        DELETE FROM export_sessions WHERE format IN ('pdf', 'docx');
    `.execute(db);

    // Restore previous constraint (7 formats, no pdf/docx)
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
