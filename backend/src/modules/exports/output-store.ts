/**
 * Output Store
 *
 * File-based storage for export session output artifacts.
 * Stores generated files (PDF, DOCX, etc.) and provides
 * retrieval for the download endpoint.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { db } from '../../db/client.js';

const EXPORT_OUTPUT_DIR = process.env.EXPORT_OUTPUT_DIR
    || path.join(os.tmpdir(), 'autoart-exports');

/**
 * Store a session's generated output to disk and record the path in the database.
 */
export async function storeSessionOutput(
    sessionId: string,
    buffer: Buffer,
    mimeType: string,
    extension: string,
): Promise<string> {
    const dir = path.join(EXPORT_OUTPUT_DIR, 'exports');
    await fs.mkdir(dir, { recursive: true });

    const filename = `${sessionId}${extension}`;
    const filePath = path.join(dir, filename);

    await fs.writeFile(filePath, buffer);

    // Persist path and MIME type on the session row
    await db
        .updateTable('export_sessions')
        .set({
            output_path: filePath,
            output_mime_type: mimeType,
            updated_at: new Date(),
        })
        .where('id', '=', sessionId)
        .execute();

    return filePath;
}

/**
 * Retrieve a session's stored output from disk.
 * Returns null if no output has been stored.
 */
export async function getSessionOutput(
    sessionId: string,
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    const row = await db
        .selectFrom('export_sessions')
        .select(['output_path', 'output_mime_type', 'format', 'status'])
        .where('id', '=', sessionId)
        .executeTakeFirst();

    if (!row?.output_path || !row.output_mime_type) return null;

    try {
        const buffer = await fs.readFile(row.output_path);
        const ext = path.extname(row.output_path);
        const filename = `export-${sessionId.slice(0, 8)}${ext}`;

        return {
            buffer,
            mimeType: row.output_mime_type,
            filename,
        };
    } catch {
        // File missing from disk — stale reference
        return null;
    }
}

/**
 * Remove output files older than maxAgeMs.
 * Returns the number of files cleaned up.
 */
export async function cleanupExpiredOutputs(maxAgeMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);

    const expired = await db
        .selectFrom('export_sessions')
        .select(['id', 'output_path'])
        .where('output_path', 'is not', null)
        .where('created_at', '<', cutoff)
        .execute();

    let cleaned = 0;
    for (const row of expired) {
        if (!row.output_path) continue;
        try {
            await fs.unlink(row.output_path);
            cleaned++;
        } catch {
            // File already gone — ignore
        }
    }

    // Clear the path references
    if (expired.length > 0) {
        const ids = expired.map((r) => r.id);
        await db
            .updateTable('export_sessions')
            .set({
                output_path: null,
                output_mime_type: null,
                updated_at: new Date(),
            })
            .where('id', 'in', ids)
            .execute();
    }

    return cleaned;
}
