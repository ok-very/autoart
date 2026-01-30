/**
 * Definitions Routes
 *
 * API endpoints for soft-intrinsic system definitions
 */

import type { FastifyPluginAsync } from 'fastify';

import * as definitionsService from './definitions.service.js';

export const definitionsRoutes: FastifyPluginAsync = async (fastify) => {
    /**
     * GET /definitions/action-types
     * Returns all available action types (TASK, BUG, STORY, etc.)
     */
    fastify.get('/action-types', async (_request, reply) => {
        const types = await definitionsService.getActionTypes();
        return reply.send({
            data: types.map((t) => ({
                type: t.type,
                label: t.label,
                description: t.description,
                fieldBindings: t.field_bindings,
                defaults: t.defaults,
                isSystem: t.is_system,
            })),
        });
    });

    /**
     * GET /definitions/workflow-statuses
     * Returns workflow statuses from Task system definition
     */
    fastify.get('/workflow-statuses', async (_request, reply) => {
        const result = await definitionsService.getWorkflowStatuses();
        return reply.send({ data: result.statuses });
    });

    /**
     * GET /definitions/action-types/:type
     * Returns a single action type by key
     */
    fastify.get<{ Params: { type: string } }>('/action-types/:type', async (request, reply) => {
        const actionType = await definitionsService.getActionTypeByKey(request.params.type);
        if (!actionType) {
            return reply.status(404).send({ error: { message: 'Action type not found' } });
        }
        return reply.send({
            data: {
                type: actionType.type,
                label: actionType.label,
                description: actionType.description,
                fieldBindings: actionType.field_bindings,
                defaults: actionType.defaults,
                isSystem: actionType.is_system,
            },
        });
    });
};
