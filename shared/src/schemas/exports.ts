/**
 * Export Schemas
 *
 * Shared Zod schemas and types for the exports module.
 * Single source of truth for export data contracts between
 * frontend and backend.
 */

import { z } from 'zod';

// ============================================================================
// EXPORT FORMATS
// ============================================================================

/** Must match database CHECK constraint in migration 033/034 */
export const ExportFormatSchema = z.enum([
    'rtf',
    'plaintext',
    'markdown',
    'csv',
    'google-doc',
    'google-sheets',
    'google-slides',
]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const ExportSessionStatusSchema = z.enum([
    'configuring',  // Session created, configuring options
    'projecting',   // Generating projection from database
    'ready',        // Projection ready, awaiting execute
    'executing',    // Export in progress
    'completed',    // Successfully completed
    'failed',       // Export failed
]);
export type ExportSessionStatus = z.infer<typeof ExportSessionStatusSchema>;

// ============================================================================
// EXPORT OPTIONS
// ============================================================================

export const ExportOptionsSchema = z.object({
    includeContacts: z.boolean(),
    includeBudgets: z.boolean(),
    includeMilestones: z.boolean(),
    includeSelectionPanel: z.boolean(),
    includeOnlyOpenNextSteps: z.boolean(),
    includeStatusNotes: z.boolean(),
});
export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
    includeContacts: true,
    includeBudgets: true,
    includeMilestones: true,
    includeSelectionPanel: true,
    includeOnlyOpenNextSteps: false,
    includeStatusNotes: true,
};

// ============================================================================
// BFA PROJECT EXPORT MODEL
// ============================================================================

export const BfaBudgetValueSchema = z.object({
    numeric: z.number().optional(),
    text: z.string().optional(),
});
export type BfaBudgetValue = z.infer<typeof BfaBudgetValueSchema>;

export const BfaPhaseBudgetSchema = z.object({
    phaseLabel: z.string(),
    numeric: z.number().optional(),
    text: z.string().optional(),
});
export type BfaPhaseBudget = z.infer<typeof BfaPhaseBudgetSchema>;

export const BfaMilestoneSchema = z.object({
    kind: z.string(),
    dateText: z.string().optional(),
    normalizedDate: z.string().optional(),
    status: z.enum(['scheduled', 'completed', 'overdue']).optional(),
});
export type BfaMilestone = z.infer<typeof BfaMilestoneSchema>;

export const BfaNextStepBulletSchema = z.object({
    text: z.string(),
    completed: z.boolean(),
    ownerHint: z.string().optional(),
    dueHint: z.string().optional(),
    bulletSymbol: z.string().optional(),
    originalText: z.string().optional(),
});
export type BfaNextStepBullet = z.infer<typeof BfaNextStepBulletSchema>;

export const BfaProjectExportModelSchema = z.object({
    projectId: z.string(),
    orderingIndex: z.number(),
    category: z.enum(['public', 'corporate', 'private_corporate']),
    header: z.object({
        staffInitials: z.array(z.string()),
        clientName: z.string(),
        projectName: z.string(),
        location: z.string(),
        budgets: z.object({
            artwork: BfaBudgetValueSchema.optional(),
            total: BfaBudgetValueSchema.optional(),
            phases: z.array(BfaPhaseBudgetSchema).optional(),
        }),
        install: z.object({
            dateText: z.string().optional(),
            statusText: z.string().optional(),
        }),
        originalHeaderLine: z.string().optional(),
    }),
    contactsBlock: z.object({
        lines: z.array(z.string()),
        originalText: z.string().optional(),
    }),
    timelineBlock: z.object({
        milestones: z.array(BfaMilestoneSchema),
        originalText: z.string().optional(),
    }),
    selectionPanelBlock: z.object({
        members: z.array(z.string()),
        shortlist: z.array(z.string()),
        alternates: z.array(z.string()),
        selectedArtist: z.string().optional(),
        artworkTitle: z.string().optional(),
        originalText: z.string().optional(),
    }),
    statusBlock: z.object({
        projectStatusText: z.string().optional(),
        bfaProjectStatusText: z.string().optional(),
        nextStepsNarrative: z.string().optional(),
        stage: z.enum(['planning', 'selection', 'design', 'installation']).optional(),
        originalText: z.string().optional(),
    }),
    nextStepsBullets: z.array(BfaNextStepBulletSchema),
    rawBlockText: z.string(),
    unparsedFragments: z.array(z.string()).optional(),
    hasChanges: z.boolean(),
});
export type BfaProjectExportModel = z.infer<typeof BfaProjectExportModelSchema>;

// ============================================================================
// EXPORT SESSION
// ============================================================================

export const ExportSessionSchema = z.object({
    id: z.string(),
    format: ExportFormatSchema,
    targetConfig: z.record(z.string(), z.unknown()).optional(),
    projectIds: z.array(z.string()),
    options: ExportOptionsSchema,
    status: ExportSessionStatusSchema,
    projectionCache: z.array(BfaProjectExportModelSchema).optional(),
    error: z.string().optional(),
    createdBy: z.string().optional(),
    createdAt: z.string(),
    executedAt: z.string().optional(),
});
export type ExportSession = z.infer<typeof ExportSessionSchema>;

// ============================================================================
// EXPORT RESULT
// ============================================================================

export const ExportResultSchema = z.object({
    success: z.boolean(),
    format: ExportFormatSchema,
    /** URL to download the exported file (for file-based exports) */
    downloadUrl: z.string().optional(),
    /** Direct content (for plain-text, markdown) */
    content: z.string().optional(),
    /** External document URL (for Google Docs) */
    externalUrl: z.string().optional(),
    /** Error message if failed */
    error: z.string().optional(),
});
export type ExportResult = z.infer<typeof ExportResultSchema>;
