/**
 * Definitions Routes
 *
 * API endpoints for soft-intrinsic system definitions
 */

import type { FastifyPluginAsync } from 'fastify';

import * as definitionsService from './definitions.service.js';

export const definitionsRoutes: FastifyPluginAsync = async (fastify) => {
    /**
     * GET /definitions/workflow-statuses
     * Returns workflow statuses from Task system definition
     */
    fastify.get('/workflow-statuses', async (_request, reply) => {
        const result = await definitionsService.getWorkflowStatuses();
        return reply.send({ data: result.statuses });
    });
};
