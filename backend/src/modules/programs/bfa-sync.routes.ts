/**
 * BFA Sync Routes
 *
 * HTTP API for BFA sync diff operations:
 * - POST /sync         — Trigger diff computation for a board
 * - GET  /sync/:id     — Get diff report for a board config
 * - GET  /sync         — List recent diff reports
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as bfaSyncService from './bfa-sync.service.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const TriggerSyncBodySchema = z.object({
    boardConfigId: z.string().uuid(),
});

const BoardConfigIdParamSchema = z.object({
    id: z.string().uuid(),
});

const ListQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function bfaSyncRoutes(app: FastifyInstance) {
    /**
     * Trigger a BFA sync diff computation.
     * Fetches current Monday data, compares against local state,
     * and stores the resulting diff report.
     */
    app.post('/sync', {
        preHandler: [app.authenticate],
    }, async (request, reply) => {
        const body = TriggerSyncBodySchema.parse(request.body);
        const userId = (request.user as { userId: string }).userId;

        const report = await bfaSyncService.computeDiff(
            body.boardConfigId,
            userId,
        );

        return reply.status(201).send(report);
    });

    /**
     * Get the most recent diff report for a board config.
     */
    app.get('/sync/:id', {
        preHandler: [app.authenticate],
    }, async (request, reply) => {
        const { id } = BoardConfigIdParamSchema.parse(request.params);
        const report = await bfaSyncService.getDiffReport(id);

        if (!report) {
            return reply.status(404).send({ error: 'No diff report found for this board config' });
        }

        return reply.send(report);
    });

    /**
     * List recent diff reports across all board configs.
     */
    app.get('/sync', {
        preHandler: [app.authenticate],
    }, async (request, reply) => {
        const { limit } = ListQuerySchema.parse(request.query);
        const reports = await bfaSyncService.listDiffReports(limit);
        return reply.send(reports);
    });
}
