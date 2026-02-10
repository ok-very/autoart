/**
 * Export Workbench Types
 *
 * Re-exports shared types from @autoart/shared and provides
 * frontend-specific UI constants.
 */

// Re-export all shared export types
export {
    type ExportFormat,
    type ExportSessionStatus,
    type ExportOptions,
    DEFAULT_EXPORT_OPTIONS,
    type BfaBudgetValue,
    type BfaPhaseBudget,
    type BfaMilestone,
    type BfaNextStepBullet,
    type BfaProjectExportModel,
    type ExportSession,
    type ExportResult,
} from '@autoart/shared';

// ============================================================================
// UI CONSTANTS (Frontend-only)
// ============================================================================

import type { ExportFormat } from '@autoart/shared';

export interface ExportFormatOption {
    id: ExportFormat;
    label: string;
    description: string;
    extension: string;
}

export const EXPORT_FORMATS: ExportFormatOption[] = [
    {
        id: 'rtf',
        label: 'BFA To-Do (RTF)',
        description: 'Rich Text Format matching original BFA document structure',
        extension: '.rtf',
    },
    {
        id: 'plaintext',
        label: 'Plain Text',
        description: 'Simple text format for copying/pasting',
        extension: '.txt',
    },
    {
        id: 'markdown',
        label: 'Markdown',
        description: 'Structured markdown for documentation',
        extension: '.md',
    },
    {
        id: 'csv',
        label: 'CSV Summary',
        description: 'Spreadsheet-compatible tabular data',
        extension: '.csv',
    },
    {
        id: 'google-doc',
        label: 'Google Docs',
        description: 'Export directly to Google Docs',
        extension: '',
    },
    {
        id: 'google-sheets',
        label: 'Google Sheets',
        description: 'Export to spreadsheet with budget tracking',
        extension: '',
    },
    {
        id: 'google-slides',
        label: 'Google Slides',
        description: 'Export to presentation format',
        extension: '',
    },
    {
        id: 'pdf',
        label: 'PDF Document',
        description: 'PDF document (via AutoHelper)',
        extension: '.pdf',
    },
    {
        id: 'docx',
        label: 'Word Document',
        description: 'Word .docx document',
        extension: '.docx',
    },
    // NOTE: Gantt export is triggered directly from TimelineWrapper panel,
    // not through ExportWorkbench. Re-enable when batch workflow is added.
    // {
    //     id: 'gantt',
    //     label: 'Gantt Chart (PDF)',
    //     description: 'Visual timeline with drag-and-drop',
    //     extension: '.pdf',
    // },
];

// ============================================================================
// CONTEXT HELPER TYPES (Frontend mirrors of backend types.ts)
// ============================================================================

export interface StaleProjectInfo {
    projectId: string;
    projectName: string;
    lastUpdateDate: string;
    daysSinceUpdate: number;
    isStale: boolean;
}

export interface StalenessSummary {
    total: number;
    stale: number;
    fresh: number;
    averageDaysSinceUpdate: number;
}

export interface EmailDecayInfo {
    projectId: string;
    lastEmailDate?: string;
    hasReply: boolean;
    daysSinceEmail?: number;
    suggestFollowup: boolean;
    suggestedAction?: string;
}

export interface EmailDecaySummary {
    total: number;
    withEmails: number;
    needingFollowup: number;
    averageDaysSinceEmail: number;
}

export interface BackfeedMatch {
    docProjectIndex: number;
    matchedProjectId: string | null;
    matchScore: number;
    clientName?: string;
    projectName?: string;
    lastUpdatedInDoc?: string;
}

export interface BackfeedAnalysis {
    docId: string;
    matches: BackfeedMatch[];
    existingProjectIds: string[];
    suggestedOrder: string[];
}
