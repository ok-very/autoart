/**
 * PDF Export Target
 *
 * Exports content as PDF via AutoHelper's /render/pdf endpoint.
 * Uses Playwright for HTML-to-PDF conversion with Carlito font.
 */

import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import type { ExportTarget, ValidationResult } from './export-target.interface.js';
import { generatePdfHtml } from '../formatters/pdf-formatter.js';
import { projectBfaExportModels } from '../projectors/bfa-project.projector.js';
import type { ExportOptions, BfaProjectExportModel, ExportResult, PdfPagePreset } from '@autoart/shared';

// AutoHelper base URL
const AUTOHELPER_URL = process.env.AUTOHELPER_URL || 'http://localhost:8100';


// ============================================================================
// PDF TARGET
// ============================================================================

export class PdfTarget implements ExportTarget {
    readonly id = 'pdf';
    readonly name = 'PDF Export';
    readonly description = 'PDF document with Carlito font (Calibri-compatible)';

    async validate(_config: Record<string, unknown>): Promise<ValidationResult> {
        // Check if AutoHelper is reachable
        try {
            const response = await fetch(`${AUTOHELPER_URL}/health`);
            if (!response.ok) {
                return {
                    valid: false,
                    errors: ['AutoHelper service is not responding'],
                };
            }
            return { valid: true };
        } catch {
            return {
                valid: false,
                errors: ['Cannot connect to AutoHelper service'],
            };
        }
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
            const pagePreset = (config.pagePreset as PdfPagePreset) || 'letter';

            // Generate HTML for PDF
            const html = generatePdfHtml(projects, options, pagePreset);

            // Call AutoHelper to render PDF
            const response = await fetch(`${AUTOHELPER_URL}/render/pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    html,
                    page_preset: pagePreset,
                    print_background: true,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AutoHelper render failed: ${errorText}`);
            }

            // Get PDF bytes
            const pdfBuffer = await response.arrayBuffer();

            // Write to temp file
            const filename = `bfa_todo_${new Date().toISOString().slice(0, 10)}_${randomUUID()}.pdf`;
            const filepath = join(tmpdir(), filename);

            await writeFile(filepath, Buffer.from(pdfBuffer));

            return {
                success: true,
                format: 'pdf',
                downloadUrl: filepath,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                format: 'pdf',
                error: `Failed to export PDF: ${message}`,
            };
        }
    }
}
