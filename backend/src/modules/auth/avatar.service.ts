import { createWriteStream } from 'node:fs';
import { unlink, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

import { db } from '../../db/client.js';

const AVATARS_DIR = path.resolve('uploads/avatars');
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

export class AvatarError extends Error {
    constructor(
        message: string,
        public statusCode: number = 400,
    ) {
        super(message);
        this.name = 'AvatarError';
    }
}

/**
 * Save an avatar image for a user.
 * Overwrites any previous avatar. Updates the DB column.
 */
export async function uploadAvatar(
    userId: string,
    fileStream: Readable,
    mimeType: string,
): Promise<string> {
    const ext = ALLOWED_MIME[mimeType];
    if (!ext) {
        throw new AvatarError('Unsupported image type. Use jpg, png, or webp.');
    }

    const filename = `${userId}.${ext}`;
    const filePath = path.join(AVATARS_DIR, filename);

    // Remove old avatar (different extension) before writing
    await removeAvatarFile(userId);

    // Stream to disk with size enforcement
    let written = 0;
    const ws = createWriteStream(filePath);

    const sizedStream = async function* () {
        for await (const chunk of fileStream) {
            written += chunk.length;
            if (written > MAX_SIZE) {
                throw new AvatarError('File exceeds 2MB limit.');
            }
            yield chunk;
        }
    };

    await pipeline(sizedStream, ws);

    const avatarUrl = `/api/avatars/${filename}`;

    await db
        .updateTable('users')
        .set({ avatar_url: avatarUrl })
        .where('id', '=', userId)
        .execute();

    return avatarUrl;
}

/**
 * Delete a user's avatar file and null the DB column.
 */
export async function deleteAvatar(userId: string): Promise<void> {
    await removeAvatarFile(userId);

    await db
        .updateTable('users')
        .set({ avatar_url: null })
        .where('id', '=', userId)
        .execute();
}

/**
 * Get the absolute disk path for an avatar filename.
 * Returns null if the file doesn't exist.
 */
export function getAvatarPath(filename: string): string {
    // Prevent directory traversal
    const sanitized = path.basename(filename);
    return path.join(AVATARS_DIR, sanitized);
}

async function removeAvatarFile(userId: string): Promise<void> {
    const safe = path.basename(userId);
    for (const ext of Object.values(ALLOWED_MIME)) {
        const filePath = path.join(AVATARS_DIR, `${safe}.${ext}`);
        try {
            await stat(filePath);
            await unlink(filePath);
        } catch {
            // File doesn't exist — fine
        }
    }
}
