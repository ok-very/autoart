/**
 * Export Module Registry
 * 
 * Defines the modular export system architecture
 */

import type { ExportFormat, ExportOptions } from '@autoart/shared';

export interface ExportModule {
    id: ExportFormat;
    name: string;
    description: string;
    category: 'google' | 'microsoft' | 'local';
    icon?: string;
    supportedFonts?: string[];
    defaultFont?: string;
    requiresAuth?: boolean;
}

export const EXPORT_MODULES: ExportModule[] = [
    // Google exports
    {
        id: 'google-doc',
        name: 'Google Docs',
        description: 'Export to Google Docs',
        category: 'google',
        requiresAuth: true,
    },
    {
        id: 'google-sheets',
        name: 'Google Sheets',
        description: 'Export to spreadsheet with budget tracking',
        category: 'google',
        requiresAuth: true,
    },
    {
        id: 'google-slides',
        name: 'Google Slides',
        description: 'Export to presentation format',
        category: 'google',
        requiresAuth: true,
    },
    // Local file exports
    {
        id: 'rtf',
        name: 'BFA To-Do (RTF)',
        description: 'Rich Text Format matching original BFA structure',
        category: 'local',
        defaultFont: 'Calibri',
    },
    {
        id: 'markdown',
        name: 'Markdown',
        description: 'Structured markdown for documentation',
        category: 'local',
    },
    {
        id: 'plaintext',
        name: 'Plain Text',
        description: 'Simple text format',
        category: 'local',
    },
    {
        id: 'csv',
        name: 'CSV Summary',
        description: 'Spreadsheet-compatible data',
        category: 'local',
    },
];

/**
 * Get module by ID
 */
export function getExportModule(id: ExportFormat): ExportModule | undefined {
    return EXPORT_MODULES.find((m) => m.id === id);
}

/**
 * Get modules by category
 */
export function getModulesByCategory(category: 'google' | 'microsoft' | 'local'): ExportModule[] {
    return EXPORT_MODULES.filter((m) => m.category === category);
}
