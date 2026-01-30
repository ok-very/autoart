/**
 * Imports Routes
 *
 * API endpoints for import sessions workflow:
 * - POST /sessions - Create a new import session
 * - GET /sessions/:id - Get session details
 * - POST /sessions/:id/plan - Generate import plan
 * - GET /sessions/:id/plan - Get existing plan
 * - POST /sessions/:id/execute - Execute the import
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { suggestClassificationsForPlan, type ClassificationSuggestion } from './classification-suggester.js';
import mondayWebhookRoutes from './monday/monday-webhooks.routes.js'; // Added import
import * as importsService from './services/index.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateSessionBodySchema = z.object({
    parserName: z.string().min(1),
    rawData: z.string().min(1),
    config: z.record(z.string(), z.unknown()).optional(),
    targetProjectId: z.string().uuid().optional(),
});

const SessionIdParamSchema = z.object({
    id: z.string().uuid(),
});

const CreateConnectorSessionBodySchema = z.object({
    // TODO: Add 'asana', 'notion' when implemented
    connectorType: z.enum(['monday']),
    boardId: z.string().min(1),
    targetProjectId: z.string().uuid().optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function importsRoutes(app: FastifyInstance) {
    // Register webhook routes
    await app.register(mondayWebhookRoutes, { prefix: '/api/webhooks/monday' });

    /**
     * Create a new import session
     */
    app.post('/sessions', { preHandler: [app.authenticate] }, async (request, reply) => {
        const body = CreateSessionBodySchema.parse(request.body);
        const userId = (request.user as { userId?: string })?.userId;

        const session = await importsService.createSession({
            parserName: body.parserName,
            rawData: body.rawData,
            config: body.config ?? {},
            targetProjectId: body.targetProjectId,
            userId,
        });

        return reply.status(201).send(session);
    });

    /**
     * Create a new import session from an external connector (Monday, etc.)
     * Always includes subitems - no toggle option.
     */
    app.post('/sessions/connector', { preHandler: [app.authenticate] }, async (request, reply) => {
        const body = CreateConnectorSessionBodySchema.parse(request.body);
        const userId = (request.user as { userId?: string })?.userId;

        const session = await importsService.createConnectorSession({
            connectorType: body.connectorType,
            connectorConfig: { boardId: body.boardId },
            targetProjectId: body.targetProjectId,
            userId,
        });

        const plan = await importsService.generatePlanFromConnector(session.id, userId);

        // Re-fetch session to get updated status (generatePlanFromConnector updates it)
        const updatedSession = await importsService.getSession(session.id);

        return reply.status(201).send({ session: updatedSession ?? session, plan });
    });

    /**
     * Get session details
     */
    app.get('/sessions/:id', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);
        const session = await importsService.getSession(id);

        if (!session) {
            return reply.status(404).send({ error: 'Session not found' });
        }

        return reply.send(session);
    });

    /**
     * Generate import plan for a session
     */
    app.post('/sessions/:id/plan', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);

        try {
            const plan = await importsService.generatePlan(id);
            return reply.send(plan);
        } catch (err) {
            if ((err as Error).message === 'Session not found') {
                return reply.status(404).send({ error: 'Session not found' });
            }
            if ((err as Error).message.startsWith('Parser')) {
                return reply.status(400).send({ error: (err as Error).message });
            }
            throw err;
        }
    });

    /**
     * Get existing plan for a session
     */
    app.get('/sessions/:id/plan', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);

        const plan = await importsService.getLatestPlan(id);
        if (!plan) {
            return reply.status(404).send({ error: 'No plan found for this session' });
        }

        return reply.send(plan);
    });

    /**
     * Execute import plan
     */
    app.post('/sessions/:id/execute', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);
        const userId = (request.user as { userId?: string })?.userId;

        try {
            const execution = await importsService.executeImport(id, userId);
            return reply.send(execution);
        } catch (err) {
            if ((err as Error).message === 'Session not found') {
                return reply.status(404).send({ error: 'Session not found' });
            }
            if ((err as Error).message === 'No plan found') {
                return reply.status(400).send({ error: 'Generate a plan first' });
            }
            throw err;
        }
    });

    /**
     * List sessions (optionally filtered by status)
     */
    app.get('/sessions', async (request, reply) => {
        const query = request.query as { status?: string; limit?: string };
        const status = query.status as 'pending' | 'planned' | 'needs_review' | 'executing' | 'completed' | 'failed' | undefined;
        const limit = query.limit ? parseInt(query.limit, 10) : 20;

        const sessions = await importsService.listSessions({ status, limit });
        return reply.send({ sessions });
    });

    /**
     * Save resolutions for classifications
     * Allows user to resolve AMBIGUOUS/UNCLASSIFIED items before execution
     */
    app.patch('/sessions/:id/resolutions', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);
        const body = ResolutionBodySchema.parse(request.body);

        try {
            const plan = await importsService.saveResolutions(id, body.resolutions);
            return reply.send(plan);
        } catch (err) {
            if ((err as Error).message === 'Session not found') {
                return reply.status(404).send({ error: 'Session not found' });
            }
            if ((err as Error).message === 'No plan found') {
                return reply.status(400).send({ error: 'Generate a plan first' });
            }
            throw err;
        }
    });

    /**
     * Get classification suggestions for UNCLASSIFIED items
     * Returns ranked suggestions based on partial pattern matches
     */
    app.get('/sessions/:id/suggestions', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);

        const plan = await importsService.getLatestPlan(id);
        if (!plan) {
            return reply.status(404).send({ error: 'No plan found for this session' });
        }

        const suggestionsMap = suggestClassificationsForPlan(plan.items, plan.classifications);

        // Convert Map to serializable object
        const suggestions: Record<string, ClassificationSuggestion[]> = {};
        for (const [key, value] of suggestionsMap) {
            suggestions[key] = value;
        }

        return reply.send({ suggestions });
    });

    /**
     * Delete stale import sessions
     * Removes sessions older than the specified number of days (default: 7)
     * Used by garbage collection service (internal API)
     */
    app.delete('/sessions/stale', async (request, reply) => {
        const { older_than_days } = StaleQuerySchema.parse(request.query);

        const { db } = await import('../../db/client.js');

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - older_than_days);

        // Atomic delete with RETURNING to avoid race conditions
        const deletedSessions = await db
            .deleteFrom('import_sessions')
            .where('created_at', '<', cutoffDate)
            .returning('id')
            .execute();

        const sessionIds = deletedSessions.map(s => s.id);

        return reply.send({
            deleted_count: sessionIds.length,
            session_ids: sessionIds,
        });
    });
}

// Resolution schema
const ResolutionBodySchema = z.object({
    resolutions: z.array(z.object({
        itemTempId: z.string(),
        resolvedOutcome: z.enum(['FACT_EMITTED', 'DERIVED_STATE', 'INTERNAL_WORK', 'EXTERNAL_WORK', 'AMBIGUOUS', 'UNCLASSIFIED', 'DEFERRED']),
        resolvedFactKind: z.string().optional(),
        resolvedPayload: z.record(z.string(), z.unknown()).optional(),
    })),
});

const StaleQuerySchema = z.object({
    older_than_days: z.coerce.number().int().positive().default(7),
});

export default importsRoutes;
