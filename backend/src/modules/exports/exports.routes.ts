/**
 * Exports Routes
 *
 * API endpoints for export sessions workflow:
 * - POST /sessions - Create a new export session
 * - GET /sessions/:id - Get session details
 * - POST /sessions/:id/projection - Generate export projection
 * - GET /sessions/:id/projection - Get cached projection
 * - POST /sessions/:id/execute - Execute the export
 * - GET /sessions - List sessions
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import * as backfeedingService from './backfeeding.service.js';
import { GoogleClient } from './connectors/google-client.js';
import { GoogleDocsConnector } from './connectors/google-docs-connector.js';
import { OneDriveClient } from './connectors/onedrive-client.js';
import * as emailDecayService from './email-decay.service.js';
import * as exportsService from './exports.service.js';
import * as stalenessService from './staleness.service.js';
import type { ExportFormat, ExportOptions } from './types.js';
import { getGoogleToken, getMicrosoftToken, isProviderConnected } from '../imports/connections.service.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const ExportFormatSchema = z.enum(['rtf', 'markdown', 'plaintext', 'csv', 'google-doc', 'google-sheets', 'google-slides']);

const ExportOptionsSchema = z.object({
    includeContacts: z.boolean().optional(),
    includeMilestones: z.boolean().optional(),
    includeStatusNotes: z.boolean().optional(),
    includeSelectionPanel: z.boolean().optional(),
    includeOnlyOpenNextSteps: z.boolean().optional(),
    highlightCurrentMonth: z.boolean().optional(),
});

const CreateSessionBodySchema = z.object({
    format: ExportFormatSchema,
    projectIds: z.array(z.string().uuid()),
    options: ExportOptionsSchema.optional(),
    targetConfig: z.record(z.string(), z.unknown()).optional(),
});

const SessionIdParamSchema = z.object({
    id: z.string().uuid(),
});

const StaleQuerySchema = z.object({
    older_than_days: z.coerce.number().int().positive().default(7),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function exportsRoutes(app: FastifyInstance) {
    /**
     * Create a new export session
     */
    app.post('/sessions', async (request, reply) => {
        const body = CreateSessionBodySchema.parse(request.body);
        const userId = (request.user as { id?: string })?.id;

        const session = await exportsService.createExportSession({
            format: body.format as ExportFormat,
            projectIds: body.projectIds,
            options: body.options as ExportOptions | undefined,
            targetConfig: body.targetConfig,
            userId,
        });

        return reply.status(201).send(session);
    });

    /**
     * Get session details
     */
    app.get('/sessions/:id', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);
        const session = await exportsService.getExportSession(id);

        if (!session) {
            return reply.status(404).send({ error: 'Session not found' });
        }

        return reply.send(session);
    });

    /**
     * Generate export projection for a session
     */
    app.post('/sessions/:id/projection', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);

        try {
            const projection = await exportsService.generateProjection(id);
            return reply.send({ projection });
        } catch (err) {
            if ((err as Error).message === 'Session not found') {
                return reply.status(404).send({ error: 'Session not found' });
            }
            throw err;
        }
    });

    /**
     * Get cached projection for a session
     */
    app.get('/sessions/:id/projection', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);

        const projection = await exportsService.getProjection(id);
        if (!projection) {
            return reply.status(404).send({ error: 'No projection found. Generate one first.' });
        }

        return reply.send({ projection });
    });

    /**
     * Execute export (generate final output)
     */
    app.post('/sessions/:id/execute', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);

        try {
            const result = await exportsService.executeExport(id);
            return reply.send(result);
        } catch (err) {
            if ((err as Error).message === 'Session not found') {
                return reply.status(404).send({ error: 'Session not found' });
            }
            if ((err as Error).message === 'No projection found') {
                return reply.status(400).send({ error: 'Generate a projection first' });
            }
            if ((err as Error).message.startsWith('Unsupported')) {
                return reply.status(400).send({ error: (err as Error).message });
            }
            throw err;
        }
    });

    /**
     * List sessions (optionally filtered by status or format)
     */
    app.get('/sessions', async (request, reply) => {
        const query = request.query as { status?: string; format?: string; limit?: string };
        const status = query.status as 'configuring' | 'projecting' | 'ready' | 'executing' | 'completed' | 'failed' | undefined;
        const format = query.format as ExportFormat | undefined;
        const limit = query.limit ? parseInt(query.limit, 10) : 20;

        const sessions = await exportsService.listExportSessions({ status, format, limit });
        return reply.send({ sessions });
    });

    /**
     * Update session options
     */
    app.patch('/sessions/:id', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);
        const body = z.object({
            options: ExportOptionsSchema.optional(),
            projectIds: z.array(z.string().uuid()).optional(),
            targetConfig: z.record(z.string(), z.unknown()).optional(),
        }).parse(request.body);

        try {
            // Get current session
            const session = await exportsService.getExportSession(id);
            if (!session) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            // Update session in database
            const { db } = await import('../../db/client.js');
            await db
                .updateTable('export_sessions')
                .set({
                    options: body.options ? JSON.stringify(body.options) : undefined,
                    project_ids: body.projectIds ? JSON.stringify(body.projectIds) : undefined,
                    target_config: body.targetConfig ? JSON.stringify(body.targetConfig) : undefined,
                    updated_at: new Date(),
                })
                .where('id', '=', id)
                .execute();

            const updated = await exportsService.getExportSession(id);
            return reply.send(updated);
        } catch (err) {
            throw err;
        }
    });

    /**
     * Delete a session
     */
    app.delete('/sessions/:id', async (request, reply) => {
        const { id } = SessionIdParamSchema.parse(request.params);

        const { db } = await import('../../db/client.js');
        const result = await db
            .deleteFrom('export_sessions')
            .where('id', '=', id)
            .executeTakeFirst();

        if (!result.numDeletedRows || result.numDeletedRows === BigInt(0)) {
            return reply.status(404).send({ error: 'Session not found' });
        }

        return reply.status(204).send();
    });

    /**
     * Delete stale export sessions
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
            .deleteFrom('export_sessions')
            .where('created_at', '<', cutoffDate)
            .returning('id')
            .execute();

        const sessionIds = deletedSessions.map(s => s.id);

        return reply.send({
            deleted_count: sessionIds.length,
            session_ids: sessionIds,
        });
    });

    // ========================================================================
    // GOOGLE DOCS INTEGRATION ROUTES
    // ========================================================================

    /**
     * Check if Google is connected for the current user
     */
    app.get('/google/status', async (request, reply) => {
        const userId = (request.user as { id?: string })?.id;
        const connected = await isProviderConnected(userId ?? null, 'google');
        return reply.send({ connected });
    });

    /**
     * List user's Google Docs (for selecting existing document)
     */
    app.get('/google/documents', async (request, reply) => {
        const userId = (request.user as { id?: string })?.id;

        try {
            const token = await getGoogleToken(userId);
            const connector = new GoogleDocsConnector({ accessToken: token });
            const documents = await connector.listDocuments();
            return reply.send({ documents });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to list documents';
            if (message.includes('No Google access token')) {
                return reply.status(401).send({ error: 'Google not connected. Please authenticate first.' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Analyze an existing Google Doc for backfeeding
     * Returns parsed project headers with match info for syncing with database
     */
    app.get('/google/documents/:docId/analyze', async (request, reply) => {
        const { docId } = z.object({ docId: z.string() }).parse(request.params);
        const userId = (request.user as { id?: string })?.id;

        try {
            const token = await getGoogleToken(userId);
            const connector = new GoogleDocsConnector({ accessToken: token });
            const analysis = await connector.analyzeDocument(docId);
            return reply.send(analysis);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to analyze document';
            if (message.includes('No Google access token')) {
                return reply.status(401).send({ error: 'Google not connected. Please authenticate first.' });
            }
            if (message.includes('404')) {
                return reply.status(404).send({ error: 'Document not found' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Test Google connection by listing documents
     */
    app.get('/google/test', async (request, reply) => {
        const userId = (request.user as { id?: string })?.id;

        try {
            const token = await getGoogleToken(userId);
            const connector = new GoogleDocsConnector({ accessToken: token });
            const result = await connector.testConnection();
            return reply.send(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Connection test failed';
            return reply.send({ connected: false, error: message });
        }
    });

    // ========================================================================
    // GOOGLE SHEETS INTEGRATION ROUTES
    // ========================================================================

    /**
     * List user's Google Sheets (for selecting existing spreadsheet)
     */
    app.get('/google/spreadsheets', async (request, reply) => {
        const userId = (request.user as { id?: string })?.id;

        try {
            const token = await getGoogleToken(userId);
            const client = new GoogleClient({ accessToken: token });
            // List files with spreadsheet mime type
            const files = await client.listFiles({
                mimeType: 'application/vnd.google-apps.spreadsheet',
                pageSize: 50,
            });
            return reply.send({ spreadsheets: files.files });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to list spreadsheets';
            if (message.includes('No Google access token')) {
                return reply.status(401).send({ error: 'Google not connected. Please authenticate first.' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Get a specific spreadsheet's metadata
     */
    app.get('/google/spreadsheets/:spreadsheetId', async (request, reply) => {
        const { spreadsheetId } = z.object({ spreadsheetId: z.string() }).parse(request.params);
        const userId = (request.user as { id?: string })?.id;

        try {
            const token = await getGoogleToken(userId);
            const client = new GoogleClient({ accessToken: token });
            const spreadsheet = await client.getSpreadsheet(spreadsheetId);
            return reply.send(spreadsheet);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get spreadsheet';
            if (message.includes('404')) {
                return reply.status(404).send({ error: 'Spreadsheet not found' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    // ========================================================================
    // GOOGLE SLIDES INTEGRATION ROUTES
    // ========================================================================

    /**
     * List user's Google Slides presentations
     */
    app.get('/google/presentations', async (request, reply) => {
        const userId = (request.user as { id?: string })?.id;

        try {
            const token = await getGoogleToken(userId);
            const client = new GoogleClient({ accessToken: token });
            // List files with presentation mime type
            const files = await client.listFiles({
                mimeType: 'application/vnd.google-apps.presentation',
                pageSize: 50,
            });
            return reply.send({ presentations: files.files });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to list presentations';
            if (message.includes('No Google access token')) {
                return reply.status(401).send({ error: 'Google not connected. Please authenticate first.' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Get a specific presentation's metadata
     */
    app.get('/google/presentations/:presentationId', async (request, reply) => {
        const { presentationId } = z.object({ presentationId: z.string() }).parse(request.params);
        const userId = (request.user as { id?: string })?.id;

        try {
            const token = await getGoogleToken(userId);
            const client = new GoogleClient({ accessToken: token });
            const presentation = await client.getPresentation(presentationId);
            return reply.send(presentation);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get presentation';
            if (message.includes('404')) {
                return reply.status(404).send({ error: 'Presentation not found' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    // ========================================================================
    // GOOGLE DRIVE INTEGRATION ROUTES
    // ========================================================================

    /**
     * List files in user's Drive (with optional filters)
     */
    app.get('/google/drive/files', async (request, reply) => {
        const userId = (request.user as { id?: string })?.id;
        const query = request.query as { mimeType?: string; folderId?: string; limit?: string };

        try {
            const token = await getGoogleToken(userId);
            const client = new GoogleClient({ accessToken: token });
            const files = await client.listFiles({
                mimeType: query.mimeType as 'application/vnd.google-apps.spreadsheet' | 'application/vnd.google-apps.presentation' | 'application/vnd.google-apps.document' | 'application/vnd.google-apps.folder' | undefined,
                folderId: query.folderId,
                pageSize: query.limit ? parseInt(query.limit, 10) : 50,
            });
            return reply.send(files);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to list files';
            if (message.includes('No Google access token')) {
                return reply.status(401).send({ error: 'Google not connected. Please authenticate first.' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Get file metadata
     */
    app.get('/google/drive/files/:fileId', async (request, reply) => {
        const { fileId } = z.object({ fileId: z.string() }).parse(request.params);
        const userId = (request.user as { id?: string })?.id;

        try {
            const token = await getGoogleToken(userId);
            const client = new GoogleClient({ accessToken: token });
            const file = await client.getFile(fileId);
            return reply.send(file);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get file';
            if (message.includes('404')) {
                return reply.status(404).send({ error: 'File not found' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Create a folder in Drive
     */
    app.post('/google/drive/folders', async (request, reply) => {
        const body = z.object({
            name: z.string(),
            parentId: z.string().optional(),
        }).parse(request.body);
        const userId = (request.user as { id?: string })?.id;

        try {
            const token = await getGoogleToken(userId);
            const client = new GoogleClient({ accessToken: token });
            const folder = await client.createFolder(body.name, body.parentId);
            return reply.status(201).send(folder);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create folder';
            return reply.status(500).send({ error: message });
        }
    });

    // ========================================================================
    // CONTEXT HELPER ROUTES
    // ========================================================================

    /**
     * Analyze backfeeding: match doc projects to database
     */
    app.post('/context/backfeed/:docId', async (request, reply) => {
        const { docId } = z.object({ docId: z.string() }).parse(request.params);
        const userId = (request.user as { id?: string })?.id;

        try {
            // analyzeExistingDoc returns complete BackfeedAnalysis with matches
            const analysis = await backfeedingService.analyzeExistingDoc(docId, userId);

            return reply.send({
                analysis,
                matches: analysis.matches,
                existingProjectIds: analysis.existingProjectIds,
                suggestedOrdering: analysis.suggestedOrder,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to analyze backfeeding';
            if (message.includes('No Google access token')) {
                return reply.status(401).send({ error: 'Google not connected' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Detect stale projects
     */
    app.get('/context/staleness', async (request, reply) => {
        const query = request.query as { projectIds?: string; thresholdDays?: string };

        if (!query.projectIds) {
            return reply.status(400).send({ error: 'projectIds query parameter required' });
        }

        const projectIds = query.projectIds.split(',');
        const thresholdDays = query.thresholdDays ? parseInt(query.thresholdDays, 10) : 7;

        try {
            const staleInfo = await stalenessService.detectStaleProjects(projectIds, thresholdDays);
            const summary = await stalenessService.getStalenessSummary(projectIds, thresholdDays);

            return reply.send({
                projects: staleInfo,
                summary,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to detect staleness';
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Detect email decay for projects
     */
    app.get('/context/email-decay', async (request, reply) => {
        const query = request.query as { projectIds?: string };

        if (!query.projectIds) {
            return reply.status(400).send({ error: 'projectIds query parameter required' });
        }

        const projectIds = query.projectIds.split(',');

        try {
            const decayInfo = await emailDecayService.detectEmailDecayBatch(projectIds);
            const summary = await emailDecayService.getEmailActivitySummary(projectIds);
            const needingFollowup = decayInfo.filter(p => p.suggestFollowup);

            return reply.send({
                projects: decayInfo,
                summary,
                needingFollowup,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to detect email decay';
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Get single project email decay
     */
    app.get('/context/email-decay/:projectId', async (request, reply) => {
        const { projectId } = z.object({ projectId: z.string().uuid() }).parse(request.params);

        try {
            const decayInfo = await emailDecayService.detectEmailDecay(projectId);
            return reply.send(decayInfo);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to detect email decay';
            return reply.status(500).send({ error: message });
        }
    });

    // ========================================================================
    // FINANCE EXPORT ROUTES
    // ========================================================================

    /**
     * Export invoice as PDF
     */
    app.post('/finance/invoice-pdf', async (request, reply) => {
        const body = z.object({
            invoiceId: z.string().uuid(),
            pagePreset: z.enum(['letter', 'legal', 'a4']).optional(),
        }).parse(request.body);

        try {
            const { projectInvoice } = await import('./projectors/invoice.projector.js');
            const { generateInvoicePdfHtml } = await import('@autoart/shared');
            const { env } = await import('@config/env.js');

            const model = await projectInvoice(body.invoiceId);
            if (!model) {
                return reply.status(404).send({ error: 'Invoice not found' });
            }

            const html = generateInvoicePdfHtml(model, {
                pagePreset: body.pagePreset || 'letter',
                autoHelperBaseUrl: env.AUTOHELPER_URL,
            });

            // Render PDF via AutoHelper
            const pdfResponse = await fetch(`${env.AUTOHELPER_URL}/render/pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html,
                    page_preset: body.pagePreset || 'letter',
                    print_background: true,
                }),
            });

            if (!pdfResponse.ok) {
                const errorText = await pdfResponse.text();
                return reply.status(502).send({ error: `PDF render failed: ${errorText}` });
            }

            const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

            return reply
                .header('Content-Type', 'application/pdf')
                .header('Content-Disposition', `attachment; filename="invoice-${model.invoiceNumber}.pdf"`)
                .send(pdfBuffer);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export invoice PDF';
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Export budget summary as CSV ("Boss Sheet v1")
     */
    app.post('/finance/budget-csv', async (request, reply) => {
        const body = z.object({
            projectId: z.string().uuid(),
        }).parse(request.body);

        try {
            const { formatBudgetCsv } = await import('./formatters/csv-formatter.js');
            const { db } = await import('../../db/client.js');

            // Find Budget definition
            const budgetDef = await db
                .selectFrom('record_definitions')
                .select(['id'])
                .where('name', '=', 'Budget')
                .executeTakeFirst();

            if (!budgetDef) {
                return reply.status(404).send({ error: 'Budget definition not found' });
            }

            // Get budget records for project
            const budgets = await db
                .selectFrom('records')
                .selectAll()
                .where('definition_id', '=', budgetDef.id)
                .where('classification_node_id', '=', body.projectId)
                .execute();

            const rows = budgets.map((r) => {
                const data = r.data as Record<string, unknown>;
                const allocated = extractAmountCents(data, 'allocated_amount');
                const spent = extractAmountCents(data, 'spent_amount');
                const remaining = allocated - spent;
                return {
                    name: (data.name as string) || r.unique_name,
                    allocationType: (data.allocation_type as string) || '',
                    allocated,
                    spent,
                    remaining,
                    utilizationPct: allocated > 0 ? (spent / allocated) * 100 : 0,
                    currency: (data.currency as string) || 'CAD',
                };
            });

            const csv = formatBudgetCsv(rows);

            return reply
                .header('Content-Type', 'text/csv')
                .header('Content-Disposition', `attachment; filename="budget-summary.csv"`)
                .send(csv);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export budget CSV';
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Download invoice as DOCX (Word document)
     */
    app.get('/finance/invoice-docx/:invoiceId/download', async (request, reply) => {
        const { invoiceId } = z.object({ invoiceId: z.string().uuid() }).parse(request.params);

        try {
            const { projectInvoice } = await import('./projectors/invoice.projector.js');
            const { generateInvoiceDocx } = await import('@autoart/shared');
            const { Packer } = await import('docx');

            const model = await projectInvoice(invoiceId);
            if (!model) {
                return reply.status(404).send({ error: 'Invoice not found' });
            }

            const doc = generateInvoiceDocx(model);
            const buffer = Buffer.from(await Packer.toBuffer(doc));

            return reply
                .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                .header('Content-Disposition', `attachment; filename="invoice-${model.invoiceNumber}.docx"`)
                .send(buffer);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export invoice DOCX';
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Export invoice DOCX to OneDrive
     */
    app.post('/finance/invoice-docx/:invoiceId/export/onedrive', async (request, reply) => {
        const { invoiceId } = z.object({ invoiceId: z.string().uuid() }).parse(request.params);
        const userId = (request.user as { id?: string; userId?: string })?.userId ?? (request.user as { id?: string })?.id;

        try {
            const { projectInvoice } = await import('./projectors/invoice.projector.js');
            const { generateInvoiceDocx } = await import('@autoart/shared');
            const { Packer } = await import('docx');

            const model = await projectInvoice(invoiceId);
            if (!model) {
                return reply.status(404).send({ error: 'Invoice not found' });
            }

            const doc = generateInvoiceDocx(model);
            const buffer = Buffer.from(await Packer.toBuffer(doc));

            const token = await getMicrosoftToken(userId);
            const client = new OneDriveClient({ accessToken: token });
            const result = await client.uploadFile(
                `Invoice-${model.invoiceNumber}.docx`,
                buffer
            );

            return reply.send({
                webUrl: result.webUrl,
                fileId: result.id,
                fileName: result.name,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export to OneDrive';
            if (message.includes('OAuth token') || message.includes('connect') || message.includes('not configured')) {
                return reply.status(401).send({ error: 'Microsoft not connected. Please authenticate first.' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Export invoice DOCX to Google Drive
     */
    app.post('/finance/invoice-docx/:invoiceId/export/google-drive', async (request, reply) => {
        const { invoiceId } = z.object({ invoiceId: z.string().uuid() }).parse(request.params);
        const userId = (request.user as { id?: string; userId?: string })?.userId ?? (request.user as { id?: string })?.id;

        try {
            const { projectInvoice } = await import('./projectors/invoice.projector.js');
            const { generateInvoiceDocx } = await import('@autoart/shared');
            const { Packer } = await import('docx');

            const model = await projectInvoice(invoiceId);
            if (!model) {
                return reply.status(404).send({ error: 'Invoice not found' });
            }

            const doc = generateInvoiceDocx(model);
            const buffer = Buffer.from(await Packer.toBuffer(doc));

            const token = await getGoogleToken(userId);
            const client = new GoogleClient({ accessToken: token });

            // Find or create AutoArt/Invoices folder
            const folderId = await client.findOrCreateFolder('AutoArt Invoices');

            const uploaded = await client.uploadFile(
                `Invoice-${model.invoiceNumber}.docx`,
                buffer,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                folderId
            );

            return reply.send({
                webViewLink: uploaded.webViewLink,
                fileId: uploaded.id,
                fileName: uploaded.name,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export to Google Drive';
            if (message.includes('OAuth token') || message.includes('connect') || message.includes('not configured')) {
                return reply.status(401).send({ error: 'Google not connected. Please authenticate first.' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    /**
     * Check cloud connection status for Google and Microsoft
     */
    app.get('/finance/cloud-status', async (request, reply) => {
        const userId = (request.user as { id?: string; userId?: string })?.userId ?? (request.user as { id?: string })?.id ?? null;

        const [google, microsoft] = await Promise.all([
            isProviderConnected(userId, 'google'),
            isProviderConnected(userId, 'microsoft'),
        ]);

        return reply.send({ google, microsoft });
    });

    /**
     * Export invoice list as CSV
     */
    app.post('/finance/invoice-list-csv', async (request, reply) => {
        const body = z.object({
            projectId: z.string().uuid(),
        }).parse(request.body);

        try {
            const { formatInvoiceListCsv } = await import('./formatters/csv-formatter.js');
            const { db } = await import('../../db/client.js');

            // Find Invoice definition
            const invoiceDef = await db
                .selectFrom('record_definitions')
                .select(['id'])
                .where('name', '=', 'Invoice')
                .executeTakeFirst();

            if (!invoiceDef) {
                return reply.status(404).send({ error: 'Invoice definition not found' });
            }

            // Get invoice records for project
            const invoices = await db
                .selectFrom('records')
                .selectAll()
                .where('definition_id', '=', invoiceDef.id)
                .where('classification_node_id', '=', body.projectId)
                .execute();

            const rows = invoices.map((r) => {
                const data = r.data as Record<string, unknown>;
                const total = extractAmountCents(data, 'total');
                const subtotal = extractAmountCents(data, 'subtotal');
                const tax = extractAmountCents(data, 'tax_total');
                return {
                    invoiceNumber: (data.invoice_number as string) || r.unique_name,
                    client: '',
                    issueDate: (data.issue_date as string) || '',
                    dueDate: (data.due_date as string) || '',
                    subtotal,
                    tax,
                    total,
                    status: (data.status as string) || 'Draft',
                    currency: (data.currency as string) || 'CAD',
                };
            });

            const csv = formatInvoiceListCsv(rows);

            return reply
                .header('Content-Type', 'text/csv')
                .header('Content-Disposition', `attachment; filename="invoice-list.csv"`)
                .send(csv);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export invoice list CSV';
            return reply.status(500).send({ error: message });
        }
    });
}

// ============================================================================
// HELPERS
// ============================================================================

function extractAmountCents(data: Record<string, unknown>, key: string): number {
    const val = data[key];
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val !== null && 'amount' in val) {
        return (val as { amount: number }).amount;
    }
    return 0;
}

export default exportsRoutes;
