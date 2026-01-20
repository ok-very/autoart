/**
 * Export Formatters Index
 *
 * Registry of all export formatters with factory function.
 */

import type { BfaProjectExportModel, ExportFormat, ExportOptions } from '../types.js';
import { formatAsMarkdown } from './markdown-formatter.js';
import { formatAsPlainText } from './plaintext-formatter.js';
import { formatAsRtf } from './rtf-formatter.js';
import { generatePdfHtml } from './pdf-formatter.js';

export { formatAsRtf } from './rtf-formatter.js';
export { formatAsMarkdown } from './markdown-formatter.js';
export { formatAsPlainText } from './plaintext-formatter.js';
export { generatePdfHtml } from './pdf-formatter.js';

/**
 * Formatter function signature.
 */
export type FormatterFunction = (
    projects: BfaProjectExportModel[],
    options: ExportOptions
) => string;

/**
 * Get formatter for a given export format.
 */
export function getFormatter(format: ExportFormat): FormatterFunction | null {
    switch (format) {
        case 'rtf':
            return formatAsRtf;
        case 'markdown':
            return formatAsMarkdown;
        case 'plaintext':
            return formatAsPlainText;
        case 'csv':
            // CSV formatter not yet implemented
            return null;
        case 'google-doc':
        case 'google-sheets':
        case 'google-slides':
            // Google services use direct API, not string formatter
            return null;
        case 'pdf':
            // PDF uses generatePdfHtml + AutoHelper render endpoint
            return null;
        default:
            return null;
    }
}

/**
 * Get file extension for export format.
 */
export function getFileExtension(format: ExportFormat): string {
    switch (format) {
        case 'rtf':
            return '.rtf';
        case 'markdown':
            return '.md';
        case 'plaintext':
            return '.txt';
        case 'csv':
            return '.csv';
        case 'pdf':
            return '.pdf';
        case 'google-doc':
        case 'google-sheets':
        case 'google-slides':
            return ''; // No file extension for Google services
        default:
            return '.txt';
    }
}

/**
 * Get MIME type for export format.
 */
export function getMimeType(format: ExportFormat): string {
    switch (format) {
        case 'rtf':
            return 'application/rtf';
        case 'markdown':
            return 'text/markdown';
        case 'plaintext':
            return 'text/plain';
        case 'csv':
            return 'text/csv';
        case 'pdf':
            return 'application/pdf';
        case 'google-doc':
            return 'application/vnd.google-apps.document';
        case 'google-sheets':
            return 'application/vnd.google-apps.spreadsheet';
        case 'google-slides':
            return 'application/vnd.google-apps.presentation';
        default:
            return 'text/plain';
    }
}
