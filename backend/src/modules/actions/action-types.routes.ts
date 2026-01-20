/**
 * Action Types Routes (Fastify)
 *
 * REST API endpoints for managing action type definitions.
 *
 * Endpoints:
 * - GET    /action-types        - List all action types
 * - GET    /action-types/stats  - Get usage stats
 * - GET    /action-types/:type  - Get single action type
 * - POST   /action-types        - Create new action type
 * - PATCH  /action-types/:type  - Update action type
 * - DELETE /action-types/:type  - Delete action type
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import * as actionTypesService from './action-types.service.js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const CreateActionTypeSchema = z.object({
    type: z.string().max(100).regex(/^[A-Z][A-Z0-9_]*$/, 'Type must be UPPER_SNAKE_CASE'),
    label: z.string().max(255),
    description: z.string().optional(),
    fieldBindings: z.array(z.object({
        fieldKey: z.string(),
        fieldType: z.enum(['string', 'text', 'number', 'date', 'boolean', 'enum', 'user']),
        label: z.string().optional(),
        required: z.boolean().optional(),
        defaultValue: z.unknown().optional(),
        options: z.array(z.string()).optional(),
    })).optional(),
    defaults: z.record(z.unknown()).optional(),
});

const UpdateActionTypeSchema = z.object({
    label: z.string().max(255).optional(),
    description: z.string().nullable().optional(),
    fieldBindings: z.array(z.object({
        fieldKey: z.string(),
        fieldType: z.enum(['string', 'text', 'number', 'date', 'boolean', 'enum', 'user']),
        label: z.string().optional(),
        required: z.boolean().optional(),
        defaultValue: z.unknown().optional(),
        options: z.array(z.string()).optional(),
    })).optional(),
    defaults: z.record(z.unknown()).optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

export const actionTypesRoutes: FastifyPluginAsync = async (fastify) => {
    /**
     * GET /action-types
     * List all action type definitions.
     */
    fastify.get('/', async (_request, reply) => {
        const definitions = await actionTypesService.getActionTypeDefinitions();
        return reply.send({ data: definitions });
    });

    /**
     * GET /action-types/stats
     * Get usage statistics for action types.
     */
    fastify.get('/stats', async (_request, reply) => {
        const stats = await actionTypesService.getActionTypeStats();
        return reply.send({ data: stats });
    });

    /**
     * GET /action-types/:type
     * Get a single action type definition.
     */
    fastify.get<{ Params: { type: string } }>('/:type', async (request, reply) => {
        const { type } = request.params;
        const definition = await actionTypesService.getActionTypeDefinition(type);

        if (!definition) {
            return reply.status(404).send({ error: `Action type not found: ${type}` });
        }

        return reply.send({ data: definition });
    });

    /**
     * POST /action-types
     * Create a new action type definition.
     */
    fastify.post('/', async (request, reply) => {
        const parseResult = CreateActionTypeSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: parseResult.error.message });
        }

        try {
            const definition = await actionTypesService.createActionTypeDefinition(parseResult.data);
            return reply.status(201).send({ data: definition });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return reply.status(400).send({ error: message });
        }
    });

    /**
     * PATCH /action-types/:type
     * Update an action type definition.
     */
    fastify.patch<{ Params: { type: string } }>('/:type', async (request, reply) => {
        const { type } = request.params;
        const parseResult = UpdateActionTypeSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: parseResult.error.message });
        }

        try {
            const definition = await actionTypesService.updateActionTypeDefinition(type, parseResult.data);
            return reply.send({ data: definition });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            if (message.includes('not found')) {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    /**
     * DELETE /action-types/:type
     * Delete an action type definition.
     */
    fastify.delete<{ Params: { type: string } }>('/:type', async (request, reply) => {
        const { type } = request.params;

        try {
            await actionTypesService.deleteActionTypeDefinition(type);
            return reply.send({ success: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            if (message.includes('not found')) {
                return reply.status(404).send({ error: message });
            }
            if (message.includes('Cannot delete')) {
                return reply.status(409).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });
};
