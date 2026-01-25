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


import {
    generatePdfHtml,
    generateGanttHtml,
    type ExportOptions,
    type BfaProjectExportModel,
    type ExportResult,
    type PdfPagePreset,
    type GanttProjectionOutput
} from '@autoart/shared';
import { env } from '@config/env.js';

import type { ExportTarget, ValidationResult } from './export-target.interface.js';
import { projectBfaExportModels } from '../projectors/bfa-project.projector.js';

// ============================================================================
// PDF TARGET
// ============================================================================

export class PdfTarget implements ExportTarget {
    readonly id = 'pdf';
    readonly name = 'PDF Export';
    readonly description = 'PDF document with Carlito font (Calibri-compatible)';

    async validate(_config: Record<string, unknown>): Promise<ValidationResult> {
        // Validate fetch API is available (Node 18+)
        if (typeof globalThis.fetch !== 'function') {
            return {
                valid: false,
                errors: ['Fetch API is not available in this Node environment'],
            };
        }

        // Check if AutoHelper is reachable
        try {
            const response = await fetch(`${env.AUTOHELPER_URL}/health`);
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
            // Get page preset from config or default to letter
            const pagePreset = (config.pagePreset as PdfPagePreset) || 'letter';

            // Determine content type and generate HTML
            let html: string;

            // Check if this is a Gantt projection (duck typing)
            const isGantt = (p: unknown): boolean =>
                !!p && typeof p === 'object' && 'lanes' in p && 'ticks' in p;

            if (isGantt(projection)) {
                // Use safe cast since we verified structure with isGantt
                const ganttProjection = projection as GanttProjectionOutput;
                html = generateGanttHtml(ganttProjection, {
                    title: `Gantt Export - ${ganttProjection.projectId}`,
                    printBackground: true
                });
            } else {
                // Default to BFA Project Export
                const projects = projection as BfaProjectExportModel[];
                const htmlOptions = (config.options as ExportOptions) ?? {};

                // Generate HTML for PDF using shared formatter
                html = generatePdfHtml(projects, htmlOptions, {
                    pagePreset,
                    autoHelperBaseUrl: env.AUTOHELPER_URL
                });
            }

            // Call AutoHelper to render PDF
            const response = await fetch(`${env.AUTOHELPER_URL}/render/pdf`, {
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

            // Prepare temp directory
            const tempDir = join(tmpdir(), 'autoart-pdf-exports');
            await this.ensureDirAndCleanup(tempDir);

            // Write to temp file
            const filename = `bfa_todo_${new Date().toISOString().slice(0, 10)}_${randomUUID()}.pdf`;
            const filepath = join(tempDir, filename);

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

    /**
     * Ensure temp directory exists and clean up old files
     */
    private async ensureDirAndCleanup(dir: string): Promise<void> {
        const fs = await import('fs/promises');

        try {
            await fs.mkdir(dir, { recursive: true });
        } catch {
            // Ignore if exists
        }

        try {
            const files = await fs.readdir(dir);
            const now = Date.now();
            const ONE_HOUR = 60 * 60 * 1000;

            for (const file of files) {
                if (!file.endsWith('.pdf')) continue;

                try {
                    const filePath = join(dir, file);
                    const stats = await fs.stat(filePath);
                    if (now - stats.mtimeMs > ONE_HOUR) {
                        await fs.unlink(filePath);
                    }
                } catch {
                    // Ignore individual file errors
                }
            }
        } catch (e) {
            console.error('Failed to cleanup temp PDF files:', e);
        }
    }
}
