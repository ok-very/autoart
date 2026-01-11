/**
 * Export Types
 *
 * Re-exports shared types from @autoart/shared and provides
 * backend-specific extensions for staleness and backfeeding.
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
// STALENESS & REMINDER TYPES (Backend-only)
// ============================================================================

export interface StaleProjectInfo {
    projectId: string;
    projectName: string;
    lastUpdateDate: Date;
    daysSinceUpdate: number;
    isStale: boolean;
}

export interface EmailDecayInfo {
    projectId: string;
    lastEmailDate?: Date;
    hasReply: boolean;
    daysSinceEmail?: number;
    suggestFollowup: boolean;
    suggestedAction?: string;
}

// ============================================================================
// BACKFEEDING TYPES (Google Docs context helper - Backend-only)
// ============================================================================

export interface BackfeedMatch {
    /** Index of the project in the existing doc */
    docProjectIndex: number;
    /** Matched project ID from database */
    matchedProjectId: string | null;
    /** Match confidence score (0-100) */
    matchScore: number;
    /** Client name extracted from doc */
    clientName?: string;
    /** Project name extracted from doc */
    projectName?: string;
    /** Last update date found in doc */
    lastUpdatedInDoc?: Date;
}

export interface BackfeedAnalysis {
    /** Google Doc ID analyzed */
    docId: string;
    /** Projects found in the existing document */
    matches: BackfeedMatch[];
    /** Project IDs already in doc (for filtering new additions) */
    existingProjectIds: string[];
    /** Suggested ordering based on doc structure */
    suggestedOrder: string[];
}
