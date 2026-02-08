/**
 * BFA Sync Routes
 *
 * HTTP API for BFA sync diff operations:
 * - POST /sync              — Trigger diff computation for a board
 * - GET  /sync/:id          — Get diff report for a board config
 * - GET  /sync              — List recent diff reports
 * - POST /sync/:id/decisions — Submit/update decisions for field changes
 * - GET  /sync/:id/decisions  — List decisions for a board config
 * - POST /sync/:id/apply     — Apply accepted decisions to local entities
 * - POST /sync/:id/inject    — Inject changes into a Google Doc
 * - POST /sync/:id/import    — Import BFA projects into AutoArt hierarchy
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { BfaSubmitDecisionsInputSchema } from '@autoart/shared';

import * as bfaImportService from './bfa-import.service.js';
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

const DecisionsQuerySchema = z.object({
    reportId: z.string().uuid().optional(),
    assignedTo: z.string().uuid().optional(),
});

const InjectBodySchema = z.object({
    documentId: z.string().min(1),
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

    // ========================================================================
    // DECISION ROUTES
    // ========================================================================

    /**
     * Submit or update decisions for field changes in a report.
     * Requires a current report to exist for the board config.
     */
    app.post('/sync/:id/decisions', {
        preHandler: [app.authenticate],
    }, async (request, reply) => {
        const { id: boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        const userId = (request.user as { userId: string }).userId;
        const body = BfaSubmitDecisionsInputSchema.parse(request.body);

        // Verify report exists
        const report = await bfaSyncService.getDiffReport(boardConfigId);
        if (!report) {
            return reply.status(404).send({ error: 'No diff report found for this board config' });
        }

        const result = await bfaSyncService.submitDecisions(
            boardConfigId,
            report.id,
            body.decisions,
            userId,
        );

        return reply.send(result);
    });

    /**
     * List decisions for a board config, with optional filters.
     */
    app.get('/sync/:id/decisions', {
        preHandler: [app.authenticate],
    }, async (request, reply) => {
        const { id: boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        const { reportId, assignedTo } = DecisionsQuerySchema.parse(request.query);

        const decisions = await bfaSyncService.listDecisions(
            boardConfigId,
            reportId,
            assignedTo,
        );

        // Map to camelCase for API response
        const mapped = decisions.map(d => ({
            id: d.id,
            reportId: d.report_id,
            entityId: d.entity_id,
            field: d.field,
            sourceField: d.source_field,
            oldValue: d.old_value,
            newValue: d.new_value,
            authority: d.authority,
            severity: d.severity,
            decision: d.decision,
            decidedBy: d.decided_by,
            decidedAt: d.decided_at?.toISOString() ?? null,
            assignedTo: d.assigned_to,
            appliedAt: d.applied_at?.toISOString() ?? null,
        }));

        return reply.send(mapped);
    });

    /**
     * Apply accepted decisions to local entities.
     * Auto-accepts monday-authority changes, applies accepted merge-authority changes.
     */
    app.post('/sync/:id/apply', {
        preHandler: [app.authenticate],
    }, async (request, reply) => {
        const { id: boardConfigId } = BoardConfigIdParamSchema.parse(request.params);

        const result = await bfaSyncService.applyDecisions(boardConfigId);
        return reply.send(result);
    });

    /**
     * Inject applied sync changes into a Google Doc.
     * Replaces per-project sections with updated content and highlights changes.
     */
    app.post('/sync/:id/inject', {
        preHandler: [app.authenticate],
    }, async (request, reply) => {
        const { id: boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        const { documentId } = InjectBodySchema.parse(request.body);
        const userId = (request.user as { userId: string }).userId;

        const result = await bfaSyncService.injectToGoogleDoc(
            boardConfigId, documentId, userId,
        );
        return reply.send(result);
    });

    // ========================================================================
    // IMPORT ROUTE
    // ========================================================================

    /**
     * Import BFA projects into AutoArt hierarchy.
     * Creates/updates project nodes, milestone phases, next step subprocesses,
     * and associated records (contacts, selection panels).
     * Requires applied decisions to exist for the board config.
     */
    app.post('/sync/:id/import', {
        preHandler: [app.authenticate],
    }, async (request, reply) => {
        const { id: boardConfigId } = BoardConfigIdParamSchema.parse(request.params);
        const userId = (request.user as { userId: string }).userId;

        const result = await bfaImportService.importToAutoArt(boardConfigId, userId);
        return reply.send(result);
    });
}
