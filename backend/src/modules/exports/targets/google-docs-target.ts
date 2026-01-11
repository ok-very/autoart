/**
 * Google Docs Export Target
 *
 * Exports to Google Docs via Google Docs API.
 * Supports creating new docs or updating existing ones.
 */

import type { ExportTarget, ValidationResult } from './export-target.interface.js';
import type { ExportOptions, BfaProjectExportModel, ExportResult } from '../types.js';
import { projectBfaExportModels } from '../projectors/bfa-project.projector.js';
import { GoogleDocsConnector } from '../connectors/google-docs-connector.js';
import { getGoogleToken } from '@utils/auth.js';

// ============================================================================
// GOOGLE DOCS TARGET
// ============================================================================

export class GoogleDocsTarget implements ExportTarget {
    readonly id = 'google-docs';
    readonly name = 'Google Docs';
    readonly description = 'Export to Google Docs with BFA formatting';
    readonly requiredScopes = [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive.file',
    ];

    async validate(config: Record<string, unknown>): Promise<ValidationResult> {
        const userId = config.userId as string | undefined;

        try {
            // Check if Google token is available
            await getGoogleToken(userId);
            return { valid: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                valid: false,
                errors: [`Google authentication required: ${message}`],
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
            const userId = config.userId as string | undefined;
            const targetDocId = config.documentId as string | undefined;
            const docTitle = config.title as string ||
                `BFA To-Do Export - ${new Date().toISOString().slice(0, 10)}`;
            const options = config.options as ExportOptions;

            // Get OAuth token
            const accessToken = await getGoogleToken(userId);
            const connector = new GoogleDocsConnector({ accessToken });

            // Create or update document
            let result;
            if (targetDocId) {
                result = await connector.updateDocument(targetDocId, projects, options);
            } else {
                result = await connector.createDocument(docTitle, projects, options);
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
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                format: 'google-doc',
                error: `Failed to export to Google Docs: ${message}`,
            };
        }
    }
}
