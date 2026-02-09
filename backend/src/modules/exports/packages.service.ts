/**
 * Package Service
 *
 * Business logic for the export package queue:
 * - Submit packages from various sources
 * - Configure format/options
 * - Generate projections via projector registry
 * - Execute exports by delegating to export sessions
 */

import type {
    ExportPackage,
    SubmitPackageBody,
    UpdatePackageBody,
    PackageStatus,
} from '@autoart/shared';
import type { ExportOptions, ExportResult } from './types.js';

import { db } from '../../db/client.js';
import { getProjector } from './projectors/registry.js';
import { createExportSession, executeExport, getExportSession } from './exports.service.js';
import { DEFAULT_EXPORT_OPTIONS } from './types.js';

// ============================================================================
// HELPERS
// ============================================================================

function parseJsonb<T>(value: unknown): T {
    if (typeof value === 'string') return JSON.parse(value);
    return value as T;
}

function mapDbToPackage(row: {
    id: string;
    label: string;
    source_type: string;
    source_payload: unknown;
    resolution_state: unknown | null;
    format: string | null;
    options: unknown;
    target_config: unknown | null;
    status: string;
    projection_cache: unknown | null;
    output_path: string | null;
    output_mime_type: string | null;
    error: string | null;
    export_session_id: string | null;
    submitted_by: string | null;
    position: number;
    created_at: Date;
    updated_at: Date;
    executed_at: Date | null;
}): ExportPackage {
    return {
        id: row.id,
        label: row.label,
        sourceType: row.source_type as ExportPackage['sourceType'],
        sourcePayload: parseJsonb(row.source_payload),
        resolutionState: row.resolution_state
            ? parseJsonb<ExportPackage['resolutionState']>(row.resolution_state)
            : undefined,
        format: row.format ? (row.format as ExportPackage['format']) : undefined,
        options: row.options ? parseJsonb<ExportOptions>(row.options) : undefined,
        targetConfig: row.target_config
            ? parseJsonb<Record<string, unknown>>(row.target_config)
            : undefined,
        status: row.status as PackageStatus,
        projectionCache: row.projection_cache
            ? parseJsonb(row.projection_cache)
            : undefined,
        outputPath: row.output_path ?? undefined,
        outputMimeType: row.output_mime_type ?? undefined,
        error: row.error ?? undefined,
        exportSessionId: row.export_session_id ?? undefined,
        submittedBy: row.submitted_by ?? undefined,
        submittedAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        executedAt: row.executed_at?.toISOString(),
        position: row.position,
    };
}

// ============================================================================
// CRUD
// ============================================================================

export async function submitPackage(
    body: SubmitPackageBody,
    userId?: string,
): Promise<ExportPackage> {
    // Compute next position
    const maxPos = await db
        .selectFrom('export_packages')
        .select(db.fn.max('position').as('max_pos'))
        .executeTakeFirst();
    const nextPosition = ((maxPos?.max_pos as number | null) ?? -1) + 1;

    // Build source payload and label based on source type
    let sourcePayload: unknown;
    let label: string;

    switch (body.sourceType) {
        case 'project_selection': {
            sourcePayload = { projectIds: body.projectIds };
            label = body.label ?? `Export (${body.projectIds.length} project${body.projectIds.length === 1 ? '' : 's'})`;
            break;
        }
        default:
            throw new Error(`Unsupported source type: ${(body as { sourceType: string }).sourceType}`);
    }

    const row = await db
        .insertInto('export_packages')
        .values({
            label,
            source_type: body.sourceType,
            source_payload: JSON.stringify(sourcePayload),
            format: body.format ?? null,
            options: body.options ? JSON.stringify(body.options) : JSON.stringify({}),
            status: 'pending',
            submitted_by: userId ?? null,
            position: nextPosition,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return mapDbToPackage(row);
}

export async function getPackage(id: string): Promise<ExportPackage | null> {
    const row = await db
        .selectFrom('export_packages')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();

    return row ? mapDbToPackage(row) : null;
}

export async function listPackages(filter?: {
    status?: string;
}): Promise<ExportPackage[]> {
    let query = db
        .selectFrom('export_packages')
        .selectAll()
        .orderBy('position', 'asc')
        .orderBy('created_at', 'desc');

    if (filter?.status) {
        query = query.where('status', '=', filter.status);
    }

    const rows = await query.execute();
    return rows.map(mapDbToPackage);
}

export async function updatePackage(
    id: string,
    updates: UpdatePackageBody,
): Promise<ExportPackage> {
    const values: Record<string, unknown> = {
        updated_at: new Date(),
    };

    if (updates.label !== undefined) values.label = updates.label;
    if (updates.format !== undefined) values.format = updates.format;
    if (updates.options !== undefined) values.options = JSON.stringify(updates.options);
    if (updates.targetConfig !== undefined) values.target_config = JSON.stringify(updates.targetConfig);

    // Auto-transition: pending → configuring when format is set
    if (updates.format) {
        const current = await getPackage(id);
        if (current?.status === 'pending') {
            values.status = 'configuring';
        }
    }

    const row = await db
        .updateTable('export_packages')
        .set(values)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

    return mapDbToPackage(row);
}

export async function deletePackage(id: string): Promise<void> {
    await db
        .deleteFrom('export_packages')
        .where('id', '=', id)
        .execute();
}

// ============================================================================
// PROJECTION
// ============================================================================

export async function generatePackageProjection(id: string): Promise<unknown> {
    // Set status → projecting
    await db
        .updateTable('export_packages')
        .set({ status: 'projecting', updated_at: new Date() })
        .where('id', '=', id)
        .execute();

    const pkg = await getPackage(id);
    if (!pkg) throw new Error(`Package not found: ${id}`);

    try {
        const projector = getProjector(pkg.sourceType);
        const options = pkg.options ?? DEFAULT_EXPORT_OPTIONS;
        const projection = await projector(pkg.sourcePayload, options);

        // Cache projection and set status → ready
        await db
            .updateTable('export_packages')
            .set({
                projection_cache: JSON.stringify(projection),
                status: 'ready',
                updated_at: new Date(),
            })
            .where('id', '=', id)
            .execute();

        return projection;
    } catch (err) {
        await db
            .updateTable('export_packages')
            .set({
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
                updated_at: new Date(),
            })
            .where('id', '=', id)
            .execute();
        throw err;
    }
}

// ============================================================================
// EXECUTION
// ============================================================================

export async function executePackageExport(id: string): Promise<ExportResult> {
    const pkg = await getPackage(id);
    if (!pkg) throw new Error(`Package not found: ${id}`);

    // Set status → executing
    await db
        .updateTable('export_packages')
        .set({ status: 'executing', updated_at: new Date() })
        .where('id', '=', id)
        .execute();

    try {
        // Generate projection if missing
        let projectionCache = pkg.projectionCache;
        if (!projectionCache) {
            projectionCache = await generatePackageProjection(id);
        }

        // Determine format — default to 'rtf' if not configured
        const format = pkg.format ?? 'rtf';
        const options = pkg.options ?? DEFAULT_EXPORT_OPTIONS;

        // Extract project IDs from source payload for session creation
        const payload = pkg.sourcePayload as { projectIds?: string[] };
        const projectIds = payload.projectIds ?? [];

        // Create underlying export session
        const session = await createExportSession({
            format,
            projectIds,
            options,
            targetConfig: pkg.targetConfig,
            userId: pkg.submittedBy,
        });

        // Execute the export via existing session pipeline
        const result = await executeExport(session.id);

        // Get updated session to copy output metadata
        const updatedSession = await getExportSession(session.id);

        // Update package with results
        await db
            .updateTable('export_packages')
            .set({
                status: 'completed',
                export_session_id: session.id,
                output_path: updatedSession?.outputPath ?? null,
                output_mime_type: updatedSession?.outputMimeType ?? null,
                executed_at: new Date(),
                updated_at: new Date(),
            })
            .where('id', '=', id)
            .execute();

        return result;
    } catch (err) {
        await db
            .updateTable('export_packages')
            .set({
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
                updated_at: new Date(),
            })
            .where('id', '=', id)
            .execute();

        return {
            success: false,
            format: pkg.format ?? 'rtf',
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ============================================================================
// REORDER
// ============================================================================

export async function reorderPackages(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
        await db
            .updateTable('export_packages')
            .set({ position: i, updated_at: new Date() })
            .where('id', '=', orderedIds[i])
            .execute();
    }
}
