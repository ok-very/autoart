/**
 * Export Formatters Index
 *
 * Registry of all export formatters with factory function.
 */

import type { BfaProjectExportModel, ExportFormat, ExportOptions } from '../types.js';
import { formatAsRtf } from './rtf-formatter.js';
import { formatAsMarkdown } from './markdown-formatter.js';
import { formatAsPlainText } from './plaintext-formatter.js';

export { formatAsRtf } from './rtf-formatter.js';
export { formatAsMarkdown } from './markdown-formatter.js';
export { formatAsPlainText } from './plaintext-formatter.js';

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
            // Google Docs uses direct API, not string formatter
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
        case 'google-doc':
            return ''; // No file extension for Google Docs
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
        case 'google-doc':
            return 'application/vnd.google-apps.document';
        default:
            return 'text/plain';
    }
}
