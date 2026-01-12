/**
 * Import Types
 *
 * Shared types for the imports module.
 * Includes classification support for two-phase import gate.
 */

import type { ClassificationOutcome } from '@autoart/shared';

// ============================================================================
// CLASSIFICATION TYPES
// ============================================================================

/**
 * Classification result for a single import item.
 * Stored in ImportPlan for gating execution.
 */
export interface ItemClassification {
    /** Reference to the item being classified */
    itemTempId: string;

    /** Classification outcome from mapping rules */
    outcome: ClassificationOutcome;

    /** Confidence level of the classification */
    confidence: 'high' | 'medium' | 'low';

    /** Human-readable explanation for the classification */
    rationale: string;

    /** Events to emit for FACT_EMITTED outcomes */
    emittedEvents?: Array<{
        type: string;
        payload: Record<string, unknown>;
    }>;

    /** Candidate fact kinds for AMBIGUOUS outcomes */
    candidates?: string[];

    /**
     * V2 interpretation plan for commit phase.
     * Contains structured outputs (fact_candidate, work_event, field_value, action_hint).
     */
    interpretationPlan?: {
        outputs: Array<{
            kind: 'fact_candidate' | 'work_event' | 'field_value' | 'action_hint';
            [key: string]: unknown;
        }>;
        /** The statusEvent can be any InterpretationOutput but is typically work_event */
        statusEvent?: {
            kind: 'fact_candidate' | 'work_event' | 'field_value' | 'action_hint';
            [key: string]: unknown;
        };
        raw: {
            text: string;
            status?: string;
            targetDate?: string;
            parentTitle?: string;
            stageName?: string;
            metadata?: Record<string, unknown>;
        };
    };

    /** User resolution (set via resolution API) */
    resolution?: {
        resolvedOutcome: ClassificationOutcome;
        resolvedFactKind?: string;
        resolvedPayload?: Record<string, unknown>;
    };

    /** Schema matching result for definition selection */
    schemaMatch?: {
        /** Matched definition ID (null if no match) */
        definitionId: string | null;
        /** Matched definition name (null if no match) */
        definitionName: string | null;
        /** Match quality score (0-1) */
        matchScore: number;
        /** Proposed new definition if no good match */
        proposedDefinition?: {
            name: string;
            schemaConfig: { fields: Array<{ key: string; type: string; label: string }> };
        };
    };
}

// ============================================================================
// IMPORT PLAN TYPES
// ============================================================================

export interface ImportPlanContainer {
    tempId: string;
    type: 'project' | 'process' | 'stage' | 'subprocess';
    title: string;
    parentTempId: string | null;
    /** Optional hint for classification (e.g., 'process', 'stage', 'subprocess') */
    definitionName?: string;
}

export interface ImportPlanItem {
    tempId: string;
    title: string;
    /** Parent container temp ID (optional for connector imports) */
    parentTempId?: string;
    metadata: Record<string, unknown>;
    /** Entity type inferred from source (project, stage, action, task, subtask, record) */
    entityType?: 'project' | 'stage' | 'action' | 'task' | 'subtask' | 'record';
    /** Planned action for execution (optional for connector imports) */
    plannedAction?: {
        type: string;
        payload: Record<string, unknown>;
    };
    fieldRecordings: Array<{
        fieldName: string;
        value: unknown;
        /** Rendering hint for UI component selection (status, date, person, etc.) */
        renderHint?: string;
    }>;
}

export interface ImportPlan {
    sessionId: string;
    containers: ImportPlanContainer[];
    items: ImportPlanItem[];
    validationIssues: Array<{
        severity: 'error' | 'warning';
        message: string;
        recordTempId?: string;
    }>;
    /** Classification results for each item (gating execution) */
    classifications: ItemClassification[];
}

export interface ParseResult {
    containers: ImportPlanContainer[];
    items: ImportPlanItem[];
    validationIssues: Array<{
        severity: 'error' | 'warning';
        message: string;
        recordTempId?: string;
    }>;
}

export type FieldRecording = { fieldName: string; value: unknown };

// ============================================================================
// IMPORT SESSION STATUS
// ============================================================================

export type ImportSessionStatus =
    | 'pending'      // Session created, no plan yet
    | 'planned'      // Plan generated, ready to execute
    | 'needs_review' // Has AMBIGUOUS/UNCLASSIFIED items
    | 'executing'    // Execution in progress
    | 'completed'    // Successfully completed
    | 'failed';      // Execution failed

/**
 * Check if a plan has unresolved classifications.
 */
export function hasUnresolvedClassifications(plan: ImportPlan): boolean {
    return plan.classifications.some(c =>
        (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED') &&
        !c.resolution
    );
}

/**
 * Count unresolved classifications by outcome.
 */
export function countUnresolved(plan: ImportPlan): { ambiguous: number; unclassified: number } {
    let ambiguous = 0;
    let unclassified = 0;

    for (const c of plan.classifications) {
        if (c.resolution) continue;
        if (c.outcome === 'AMBIGUOUS') ambiguous++;
        if (c.outcome === 'UNCLASSIFIED') unclassified++;
    }

    return { ambiguous, unclassified };
}
