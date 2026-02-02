import type { FastifyRequest, FastifyReply } from 'fastify';

import { getUserById } from '../modules/auth/auth.service.js';

/**
 * Fastify preHandler that checks the authenticated user's role.
 * Performs a DB lookup per request — fine for low-frequency admin routes.
 * Returns 403 if the user's role is not in the allowed set.
 */
export function requireRole(...allowed: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getUserById(request.user.userId);
        if (!user || !allowed.includes(user.role)) {
            return reply.code(403).send({
                error: 'FORBIDDEN',
                message: 'Insufficient permissions',
            });
        }
    };
}
