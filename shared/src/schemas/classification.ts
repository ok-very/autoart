/**
 * Classification Types
 *
 * Defines the classification framework for CSV row interpretation.
 * Every row must be classified, even if it produces no events.
 *
 * Principle: Ingestion classification must be total, event emission selective.
 */

import { z } from 'zod';

// ============================================================================
// CLASSIFICATION OUTCOME
// ============================================================================

export const ClassificationOutcomeSchema = z.enum([
    'FACT_EMITTED',    // Will emit FACT_RECORDED event during execution (via interpretationPlan)
    'DERIVED_STATE',   // Work lifecycle event only (from status column, auto-commit)
    'INTERNAL_WORK',   // No events; internal deliberation
    'EXTERNAL_WORK',   // No events; outward-facing work (requests, communications)
    'AMBIGUOUS',       // Needs human review
    'UNCLASSIFIED',    // Unknown pattern (data quality issue)
    'DEFERRED',        // Moved to editor-only, excluded from execution
]);
export type ClassificationOutcome = z.infer<typeof ClassificationOutcomeSchema>;

// ============================================================================
// CLASSIFICATION RESULT
// ============================================================================

export const ClassificationResultSchema = z.object({
    /** The classification outcome for this row */
    outcome: ClassificationOutcomeSchema,

    /** Confidence level of the classification */
    confidence: z.enum(['high', 'medium', 'low']),

    /** Human-readable explanation for why this classification was chosen */
    rationale: z.string(),

    /** For AMBIGUOUS: possible fact kinds this could be */
    candidates: z.array(z.string()).optional(),

    /** Source text that was classified */
    sourceText: z.string().optional(),
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// ============================================================================
// RENDERING RULES (CONSTANTS)
// ============================================================================

/**
 * Outcomes that appear in the Execution Log.
 */
export const EXECUTION_LOG_OUTCOMES: ClassificationOutcome[] = [
    'FACT_EMITTED',
    'DERIVED_STATE',
];

/**
 * Outcomes that appear only in Import Workbench (audit surface).
 */
export const IMPORT_WORKBENCH_ONLY: ClassificationOutcome[] = [
    'INTERNAL_WORK',
    'AMBIGUOUS',
    'UNCLASSIFIED',
    'DEFERRED',
];

// ============================================================================
// INTERNAL WORK PATTERNS
// ============================================================================

/**
 * Patterns that indicate internal deliberation (no events).
 * Used by the classifier to identify INTERNAL_WORK rows.
 */
export const INTERNAL_WORK_PATTERNS = [
    /^review\s/i,
    /^develop\s/i,
    /^determine\s/i,
    /^identify\s/i,
    /^brainstorm/i,
    /^consider\s/i,
    /^finalize\s/i,
    /^assemble\s/i,
    /^incorporate\s/i,
    /^assign\s/i,
    /^update\s*(contacts|timeline)/i,
    /^add\s*project\s*to/i,
    /^populate\s/i,
    /^select\s*images/i,
];

/**
 * Check if text matches an internal work pattern.
 */
export function isInternalWork(text: string): boolean {
    return INTERNAL_WORK_PATTERNS.some(pattern => pattern.test(text));
}
