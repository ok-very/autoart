/**
 * BFA RTF Export Target
 *
 * Exports BFA To-Do document as Rich Text Format.
 * First production use case for the export system.
 */

import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import type { ExportTarget, ValidationResult } from './export-target.interface.js';
import { formatAsRtf } from '../formatters/rtf-formatter.js';
import { projectBfaExportModels } from '../projectors/bfa-project.projector.js';
import type { ExportOptions, BfaProjectExportModel, ExportResult } from '../types.js';


// ============================================================================
// BFA RTF TARGET
// ============================================================================

export class BfaRtfTarget implements ExportTarget {
    readonly id = 'bfa-rtf';
    readonly name = 'BFA To-Do (RTF)';
    readonly description = 'Rich Text Format matching BFA document structure';

    async validate(_config: Record<string, unknown>): Promise<ValidationResult> {
        // RTF export doesn't require special configuration
        // Just validate we have write permissions (implicitly via OS)
        return { valid: true };
    }

    async project(
        projectIds: string[],
        options: ExportOptions
    ): Promise<BfaProjectExportModel[]> {
        return projectBfaExportModels(projectIds, options);
    }

    async execute(
        projection: unknown,
        config: Record<string, unknown>
    ): Promise<ExportResult> {
        try {
            const projects = projection as BfaProjectExportModel[];
            const options = config.options as ExportOptions;

            // Generate RTF content
            const rtfContent = formatAsRtf(projects, options);

            // Write to temp file
            const filename = `bfa_todo_${new Date().toISOString().slice(0, 10)}_${randomUUID()}.rtf`;
            const filepath = join(tmpdir(), filename);

            await writeFile(filepath, rtfContent, 'utf-8');

            return {
                success: true,
                format: 'rtf',
                downloadUrl: filepath, // In production, this would be a signed S3 URL
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                format: 'rtf',
                error: `Failed to export RTF: ${message}`,
            };
        }
    }
}
