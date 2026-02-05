import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';


import { getAvatarPath } from './avatar.service.js';

const MIME_MAP: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
};

export async function avatarRoutes(fastify: FastifyInstance) {
    interface AvatarParams {
        Params: { filename: string };
    }

    fastify.get<AvatarParams>('/:filename', async (request, reply) => {
        const filePath = getAvatarPath(request.params.filename);
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_MAP[ext];

        if (!mime) {
            return reply.code(404).send({ error: 'NOT_FOUND', message: 'Avatar not found' });
        }

        try {
            await stat(filePath);
        } catch {
            return reply.code(404).send({ error: 'NOT_FOUND', message: 'Avatar not found' });
        }

        reply.header('Content-Type', mime);
        reply.header('Cache-Control', 'public, max-age=3600');
        return reply.send(createReadStream(filePath));
    });
}
