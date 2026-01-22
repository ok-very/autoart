/**
 * Composer Routes
 *
 * HTTP endpoints for the Composer module.
 * POST /composer - Create a new work item via the Action + Event model.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { ComposerInputSchema, ComposerResponseSchema } from '@autoart/shared';

import * as composerService from './composer.service.js';

interface ComposerRequest {
    Body: unknown;
}

export async function composerRoutes(fastify: FastifyInstance) {
    /**
     * POST /composer
     *
     * Create a new work item (Action + Events + References).
     * This is the single entry point for creating any "task-like" entity
     * without touching the legacy task tables.
     *
     * Body: ComposerInputSchema
     * Response: ComposerResponseSchema
     */
    fastify.post<ComposerRequest>(
        '/',
        { preHandler: [fastify.authenticate] },
        async (request: FastifyRequest<ComposerRequest>, reply: FastifyReply) => {
            // Parse and validate the request body
            const parseResult = ComposerInputSchema.safeParse(request.body);
            if (!parseResult.success) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: 'Invalid composer input',
                    details: parseResult.error.issues,
                });
            }

            const input = parseResult.data;
            const actorId = (request.user as any)?.id || null;

            // Compose the action, events, and references
            const result = await composerService.compose(input, {
                actorId,
                skipView: false,
            });

            // Validate the response (helps catch schema drift)
            const validatedResponse = ComposerResponseSchema.parse(result);

            return reply.status(201).send(validatedResponse);
        }
    );

    /**
     * POST /composer/quick/task
     *
     * Quick endpoint for creating a simple task.
     * Convenience wrapper around the full composer.
     */
    fastify.post<{
        Body: {
            contextId: string;
            title: string;
            description?: string;
            dueDate?: string;
            /** Assignee - maps to 'owner' field key for backward compatibility */
            assignee?: string;
            references?: Array<{ sourceRecordId: string }>;
        };
    }>(
        '/quick/task',
        { preHandler: [fastify.authenticate] },
        async (request, reply) => {
            const { contextId, title, description, dueDate, assignee, references } = request.body;
            const actorId = (request.user as any)?.id || null;

            if (!contextId || !title) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: 'contextId and title are required',
                });
            }

            const result = await composerService.QuickCompose.task(
                contextId,
                title,
                { description, dueDate, assignee, actorId, references }
            );

            return reply.status(201).send(result);
        }
    );

    /**
     * POST /composer/quick/bug
     *
     * Quick endpoint for creating a bug.
     * Convenience wrapper around the full composer.
     */
    fastify.post<{
        Body: {
            contextId: string;
            title: string;
            severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            description?: string;
            references?: Array<{ sourceRecordId: string }>;
        };
    }>(
        '/quick/bug',
        { preHandler: [fastify.authenticate] },
        async (request, reply) => {
            const { contextId, title, severity, description, references } = request.body;
            const actorId = (request.user as any)?.id || null;

            if (!contextId || !title || !severity) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: 'contextId, title, and severity are required',
                });
            }

            const result = await composerService.QuickCompose.bug(
                contextId,
                title,
                severity,
                { description, actorId, references }
            );

            return reply.status(201).send(result);
        }
    );

    fastify.log.info('Composer routes registered');
}
