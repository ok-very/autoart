/**
 * Programs Module
 *
 * Program-specific sync and configuration routes.
 * Currently: BFA (Ballard Fine Art) program.
 */

import type { FastifyInstance } from 'fastify';

import { bfaSyncRoutes } from './bfa-sync.routes.js';

export async function programsRoutes(app: FastifyInstance) {
    await app.register(bfaSyncRoutes, { prefix: '/bfa' });
}
