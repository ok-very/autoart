/**
 * Exports Service
 *
 * Business logic for export sessions:
 * - Create/manage export sessions
 * - Generate projections from database state
 * - Execute exports to various formats
 * - Track export history
 */

import { GoogleDocsConnector } from './connectors/google-docs-connector.js';
import { GoogleSheetsConnector, type SheetsExportOptions } from './connectors/google-sheets-connector.js';
import { GoogleSlidesConnector, type SlidesExportOptions } from './connectors/google-slides-connector.js';
import { formatAsMarkdown } from './formatters/markdown-formatter.js';
import { formatAsPlainText } from './formatters/plaintext-formatter.js';
import { formatAsRtf } from './formatters/rtf-formatter.js';
import { storeSessionOutput } from './output-store.js';
import { projectBfaExportModels } from './projectors/bfa-project.projector.js';
import { DEFAULT_EXPORT_OPTIONS } from './types.js';
import type {
    ExportFormat,
    ExportOptions,
    ExportSession,
    ExportResult,
    BfaProjectExportModel,
    ExportSessionStatus,
} from './types.js';
import { db } from '../../db/client.js';
import { getGoogleToken } from '../imports/connections.service.js';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new export session.
 */
export async function createExportSession(params: {
    format: ExportFormat;
    projectIds: string[];
    options?: Partial<ExportOptions>;
    targetConfig?: Record<string, unknown>;
    userId?: string;
}): Promise<ExportSession> {
    const options = { ...DEFAULT_EXPORT_OPTIONS, ...params.options };

    const result = await db
        .insertInto('export_sessions')
        .values({
            format: params.format,
            project_ids: JSON.stringify(params.projectIds),
            options: JSON.stringify(options),
            target_config: params.targetConfig ? JSON.stringify(params.targetConfig) : null,
            status: 'configuring',
            created_by: params.userId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return mapDbToSession(result);
}

/**
 * Get an export session by ID.
 */
export async function getExportSession(sessionId: string): Promise<ExportSession | null> {
    const result = await db
        .selectFrom('export_sessions')
        .selectAll()
        .where('id', '=', sessionId)
        .executeTakeFirst();

    return result ? mapDbToSession(result) : null;
}

/**
 * Update export session status.
 */
export async function updateSessionStatus(
    sessionId: string,
    status: ExportSessionStatus,
    error?: string
): Promise<void> {
    await db
        .updateTable('export_sessions')
        .set({
            status,
            error: error ?? null,
            updated_at: new Date(),
            ...(status === 'completed' ? { executed_at: new Date() } : {}),
        })
        .where('id', '=', sessionId)
        .execute();
}

/**
 * List export sessions with optional filtering.
 */
export async function listExportSessions(params: {
    status?: ExportSessionStatus;
    format?: ExportFormat;
    limit?: number;
}): Promise<ExportSession[]> {
    let query = db
        .selectFrom('export_sessions')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(params.limit ?? 20);

    if (params.status) {
        query = query.where('status', '=', params.status);
    }
    if (params.format) {
        query = query.where('format', '=', params.format);
    }

    const results = await query.execute();
    return results.map(mapDbToSession);
}

// ============================================================================
// PROJECTION GENERATION
// ============================================================================

/**
 * Generate BFA export projection for the given projects.
 * Caches the result in the session for preview.
 */
export async function generateProjection(sessionId: string): Promise<BfaProjectExportModel[]> {
    const session = await getExportSession(sessionId);
    if (!session) {
        throw new Error(`Export session not found: ${sessionId}`);
    }

    // Update status to projecting
    await updateSessionStatus(sessionId, 'projecting');

    try {
        // Generate the projection from database
        const projection = await projectBfaExportModels(
            session.projectIds,
            session.options
        );

        // Cache the projection
        await db
            .updateTable('export_sessions')
            .set({
                projection_cache: JSON.stringify(projection),
                status: 'ready',
                updated_at: new Date(),
            })
            .where('id', '=', sessionId)
            .execute();

        return projection;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await updateSessionStatus(sessionId, 'failed', errorMessage);
        throw error;
    }
}

/**
 * Get cached projection from session.
 */
export async function getProjection(sessionId: string): Promise<BfaProjectExportModel[] | null> {
    const session = await getExportSession(sessionId);
    return session?.projectionCache ?? null;
}

// ============================================================================
// EXPORT EXECUTION
// ============================================================================

/**
 * Execute the export and return the result.
 */
export async function executeExport(sessionId: string): Promise<ExportResult> {
    const session = await getExportSession(sessionId);
    if (!session) {
        throw new Error(`Export session not found: ${sessionId}`);
    }

    // Get or generate projection
    let projection = session.projectionCache;
    if (!projection) {
        projection = await generateProjection(sessionId);
    }

    // Update status
    await updateSessionStatus(sessionId, 'executing');

    try {
        let result: ExportResult;

        switch (session.format) {
            case 'rtf':
                result = await exportAsRtf(projection, session);
                break;
            case 'markdown':
                result = await exportAsMarkdown(projection, session);
                break;
            case 'plaintext':
                result = await exportAsPlainText(projection, session);
                break;
            case 'csv':
                result = await exportAsCsv(projection, session);
                break;
            case 'google-doc':
                result = await exportToGoogleDoc(projection, session);
                break;
            case 'google-sheets':
                result = await exportToGoogleSheets(projection, session);
                break;
            case 'google-slides':
                result = await exportToGoogleSlides(projection, session);
                break;
            case 'pdf':
                result = await exportAsPdf(projection, session);
                break;
            case 'docx':
                result = await exportAsDocx(projection, session);
                break;
            default:
                throw new Error(`Unsupported export format: ${session.format}`);
        }

        await updateSessionStatus(sessionId, 'completed');
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await updateSessionStatus(sessionId, 'failed', errorMessage);
        return {
            success: false,
            format: session.format,
            error: errorMessage,
        };
    }
}

// ============================================================================
// FORMAT-SPECIFIC EXPORTERS
// ============================================================================

async function exportAsRtf(
    projection: BfaProjectExportModel[],
    session: ExportSession
): Promise<ExportResult> {
    const rtfContent = formatAsRtf(projection, session.options);

    // For now, return content directly
    // TODO: Store file and return download URL
    return {
        success: true,
        format: 'rtf',
        content: rtfContent,
    };
}

async function exportAsMarkdown(
    projection: BfaProjectExportModel[],
    session: ExportSession
): Promise<ExportResult> {
    const mdContent = formatAsMarkdown(projection, session.options);

    return {
        success: true,
        format: 'markdown',
        content: mdContent,
    };
}

async function exportAsPlainText(
    projection: BfaProjectExportModel[],
    session: ExportSession
): Promise<ExportResult> {
    const textContent = formatAsPlainText(projection, session.options);

    return {
        success: true,
        format: 'plaintext',
        content: textContent,
    };
}

async function exportAsCsv(
    projection: BfaProjectExportModel[],
    _session: ExportSession
): Promise<ExportResult> {
    // Build CSV rows
    const headers = [
        'Project Name',
        'Client',
        'Location',
        'Artwork Budget',
        'Total Budget',
        'Install Date',
        'Stage',
        'Selected Artist',
    ];

    const rows = projection.map((p) => [
        p.header.projectName,
        p.header.clientName,
        p.header.location,
        p.header.budgets.artwork?.text ?? '',
        p.header.budgets.total?.text ?? '',
        p.header.install.dateText ?? '',
        p.statusBlock.stage ?? '',
        p.selectionPanelBlock.selectedArtist ?? '',
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n');

    return {
        success: true,
        format: 'csv',
        content: csvContent,
    };
}

async function exportToGoogleDoc(
    projection: BfaProjectExportModel[],
    session: ExportSession
): Promise<ExportResult> {
    try {
        // Get Google OAuth token for the user
        const accessToken = await getGoogleToken(session.createdBy);

        const connector = new GoogleDocsConnector({ accessToken });

        // Check target config for existing document ID or create new
        const targetDocId = session.targetConfig?.documentId as string | undefined;
        const docTitle = session.targetConfig?.title as string ||
            `BFA To-Do Export - ${new Date().toISOString().slice(0, 10)}`;

        let result;
        if (targetDocId) {
            // Update existing document
            result = await connector.updateDocument(targetDocId, projection, session.options);
        } else {
            // Create new document
            result = await connector.createDocument(docTitle, projection, session.options);
        }

        if (!result.success) {
            return {
                success: false,
                format: 'google-doc',
                error: result.error ?? 'Failed to export to Google Docs',
            };
        }

        return {
            success: true,
            format: 'google-doc',
            externalUrl: result.documentUrl,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            success: false,
            format: 'google-doc',
            error: errorMessage,
        };
    }
}

async function exportToGoogleSheets(
    projection: BfaProjectExportModel[],
    session: ExportSession
): Promise<ExportResult> {
    try {
        // Get Google OAuth token for the user
        const accessToken = await getGoogleToken(session.createdBy);

        const connector = new GoogleSheetsConnector({ accessToken });

        // Build title
        const title = session.targetConfig?.title as string ||
            `BFA Project Export - ${new Date().toISOString().slice(0, 10)}`;

        // Build Sheets-specific options from session options
        const sheetsOptions: SheetsExportOptions = {
            ...session.options,
            includeSummarySheet: true,
            includeBudgetSheet: session.options.includeBudgets,
            includeTimelineSheet: session.options.includeMilestones,
            includeNextStepsSheet: true,
        };

        const result = await connector.createSpreadsheet(title, projection, sheetsOptions);

        if (!result.success) {
            return {
                success: false,
                format: 'google-sheets',
                error: result.error ?? 'Failed to export to Google Sheets',
            };
        }

        return {
            success: true,
            format: 'google-sheets',
            externalUrl: result.spreadsheetUrl,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            success: false,
            format: 'google-sheets',
            error: errorMessage,
        };
    }
}

async function exportToGoogleSlides(
    projection: BfaProjectExportModel[],
    session: ExportSession
): Promise<ExportResult> {
    try {
        // Get Google OAuth token for the user
        const accessToken = await getGoogleToken(session.createdBy);

        const connector = new GoogleSlidesConnector({ accessToken });

        // Build title
        const title = session.targetConfig?.title as string ||
            `BFA Project Portfolio - ${new Date().toISOString().slice(0, 10)}`;

        // Build Slides-specific options from session options
        const slidesOptions: SlidesExportOptions = {
            ...session.options,
            includeTitleSlide: true,
            includeSummarySlide: true,
            includeProjectSlides: true,
            groupByCategory: true,
            template: 'detailed',
        };

        const result = await connector.createPresentation(title, projection, slidesOptions);

        if (!result.success) {
            return {
                success: false,
                format: 'google-slides',
                error: result.error ?? 'Failed to export to Google Slides',
            };
        }

        return {
            success: true,
            format: 'google-slides',
            externalUrl: result.presentationUrl,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            success: false,
            format: 'google-slides',
            error: errorMessage,
        };
    }
}

// ============================================================================
// FINANCE EXPORT (session-routed)
// ============================================================================

/**
 * Execute a finance export preset through the session lifecycle.
 * Handles projection + formatting + output storage in one pass.
 */
export async function executeFinanceExport(
    sessionId: string,
    preset: string,
): Promise<ExportResult> {
    const session = await getExportSession(sessionId);
    if (!session) throw new Error(`Export session not found: ${sessionId}`);

    await updateSessionStatus(sessionId, 'executing');

    try {
        let result: ExportResult;

        switch (preset) {
            case 'invoice-pdf':
                result = await executeInvoicePdf(session);
                break;
            case 'invoice-docx':
                result = await executeInvoiceDocx(session);
                break;
            case 'budget-csv':
                result = await executeBudgetCsv(session);
                break;
            case 'invoice-list-csv':
                result = await executeInvoiceListCsv(session);
                break;
            default:
                throw new Error(`Unknown finance preset: ${preset}`);
        }

        await updateSessionStatus(sessionId, 'completed');
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await updateSessionStatus(sessionId, 'failed', errorMessage);
        return { success: false, format: session.format, error: errorMessage };
    }
}

async function executeInvoicePdf(session: ExportSession): Promise<ExportResult> {
    const invoiceId = session.targetConfig?.invoiceId as string;
    if (!invoiceId) throw new Error('invoiceId required for invoice-pdf preset');

    const { projectInvoice } = await import('./projectors/invoice.projector.js');
    const { generateInvoicePdfHtml } = await import('@autoart/shared');
    const { env } = await import('../../config/env.js');

    const model = await projectInvoice(invoiceId);
    if (!model) throw new Error('Invoice not found');

    const html = generateInvoicePdfHtml(model, {
        pagePreset: 'letter',
        autoHelperBaseUrl: env.AUTOHELPER_URL,
    });

    const pdfResponse = await fetch(`${env.AUTOHELPER_URL}/render/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, page_preset: 'letter', print_background: true }),
    });

    if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        throw new Error(`PDF render failed: ${errorText}`);
    }

    const buffer = Buffer.from(await pdfResponse.arrayBuffer());
    await storeSessionOutput(session.id, buffer, 'application/pdf', '.pdf');

    return {
        success: true,
        format: 'pdf',
        downloadUrl: `/api/exports/sessions/${session.id}/output`,
    };
}

async function executeInvoiceDocx(session: ExportSession): Promise<ExportResult> {
    const invoiceId = session.targetConfig?.invoiceId as string;
    if (!invoiceId) throw new Error('invoiceId required for invoice-docx preset');

    const { projectInvoice } = await import('./projectors/invoice.projector.js');
    const { generateInvoiceDocx } = await import('@autoart/shared');
    const { Packer } = await import('docx');

    const model = await projectInvoice(invoiceId);
    if (!model) throw new Error('Invoice not found');

    const doc = generateInvoiceDocx(model);
    const buffer = Buffer.from(await Packer.toBuffer(doc));

    await storeSessionOutput(
        session.id,
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.docx',
    );

    return {
        success: true,
        format: 'docx',
        downloadUrl: `/api/exports/sessions/${session.id}/output`,
    };
}

async function executeBudgetCsv(session: ExportSession): Promise<ExportResult> {
    const projectId = session.targetConfig?.projectId as string;
    if (!projectId) throw new Error('projectId required for budget-csv preset');

    const { projectBudgets } = await import('./projectors/budget.projector.js');
    const { formatBudgetCsv } = await import('./formatters/csv-formatter.js');

    const rows = await projectBudgets(projectId);
    const csv = formatBudgetCsv(rows);
    const buffer = Buffer.from(csv, 'utf-8');

    await storeSessionOutput(session.id, buffer, 'text/csv', '.csv');

    return {
        success: true,
        format: 'csv',
        downloadUrl: `/api/exports/sessions/${session.id}/output`,
    };
}

async function executeInvoiceListCsv(session: ExportSession): Promise<ExportResult> {
    const projectId = session.targetConfig?.projectId as string;
    if (!projectId) throw new Error('projectId required for invoice-list-csv preset');

    const { projectInvoiceList } = await import('./projectors/invoice-list.projector.js');
    const { formatInvoiceListCsv } = await import('./formatters/csv-formatter.js');

    const rows = await projectInvoiceList(projectId);
    const csv = formatInvoiceListCsv(rows);
    const buffer = Buffer.from(csv, 'utf-8');

    await storeSessionOutput(session.id, buffer, 'text/csv', '.csv');

    return {
        success: true,
        format: 'csv',
        downloadUrl: `/api/exports/sessions/${session.id}/output`,
    };
}

// ============================================================================
// PDF EXPORT
// ============================================================================

async function exportAsPdf(
    projection: BfaProjectExportModel[],
    session: ExportSession
): Promise<ExportResult> {
    const { generatePdfHtml } = await import('@autoart/shared');
    const { env } = await import('../../config/env.js');

    const pagePreset = (session.targetConfig?.pagePreset as string) || 'letter';
    const html = generatePdfHtml(projection, session.options, {
        pagePreset: pagePreset as 'letter' | 'legal' | 'tabloid' | 'tearsheet' | 'a4',
        autoHelperBaseUrl: env.AUTOHELPER_URL,
    });

    const pdfResponse = await fetch(`${env.AUTOHELPER_URL}/render/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            html,
            page_preset: pagePreset,
            print_background: true,
        }),
    });

    if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        throw new Error(`PDF render failed: ${errorText}`);
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    await storeSessionOutput(session.id, pdfBuffer, 'application/pdf', '.pdf');

    return {
        success: true,
        format: 'pdf',
        downloadUrl: `/api/exports/sessions/${session.id}/output`,
    };
}

// ============================================================================
// DOCX EXPORT
// ============================================================================

async function exportAsDocx(
    projection: BfaProjectExportModel[],
    session: ExportSession
): Promise<ExportResult> {
    const { generateBfaDocx } = await import('@autoart/shared');
    const { Packer } = await import('docx');

    const doc = generateBfaDocx(projection, session.options);
    const buffer = Buffer.from(await Packer.toBuffer(doc));

    await storeSessionOutput(
        session.id,
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.docx',
    );

    return {
        success: true,
        format: 'docx',
        downloadUrl: `/api/exports/sessions/${session.id}/output`,
    };
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function mapDbToSession(row: {
    id: string;
    format: string;
    project_ids: unknown;
    options: unknown;
    target_config: unknown | null;
    status: string;
    projection_cache: unknown | null;
    output_path: string | null;
    output_mime_type: string | null;
    error: string | null;
    created_by: string | null;
    created_at: Date;
    executed_at: Date | null;
}): ExportSession {
    // JSONB columns come back as unknown - parse if string, use directly if object
    const parseJsonb = <T>(value: unknown): T => {
        if (typeof value === 'string') return JSON.parse(value);
        return value as T;
    };

    return {
        id: row.id,
        format: row.format as ExportFormat,
        projectIds: parseJsonb<string[]>(row.project_ids) ?? [],
        options: parseJsonb<ExportOptions>(row.options) ?? DEFAULT_EXPORT_OPTIONS,
        targetConfig: row.target_config ? parseJsonb<Record<string, unknown>>(row.target_config) : undefined,
        status: row.status as ExportSessionStatus,
        projectionCache: row.projection_cache ? parseJsonb<BfaProjectExportModel[]>(row.projection_cache) : undefined,
        outputPath: row.output_path ?? undefined,
        outputMimeType: row.output_mime_type ?? undefined,
        error: row.error ?? undefined,
        createdBy: row.created_by ?? undefined,
        createdAt: row.created_at.toISOString(),
        executedAt: row.executed_at?.toISOString(),
    };
}
