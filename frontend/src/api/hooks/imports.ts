/**
 * Import Hooks
 *
 * React Query hooks for import sessions API.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../client';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportSession {
    id: string;
    parser_name: string;
    status: 'pending' | 'planned' | 'needs_review' | 'executing' | 'completed' | 'failed';
    created_at: string;
}

export interface ImportPlanContainer {
    tempId: string;
    type: 'project' | 'process' | 'subprocess';
    title: string;
    parentTempId: string | null;
    /** Optional hint for classification (e.g., 'process', 'stage', 'subprocess') */
    definitionName?: string;
}

export interface ImportPlanItem {
    tempId: string;
    title: string;
    parentTempId: string;
    metadata: Record<string, unknown>;
    plannedAction: {
        type: string;
        payload: Record<string, unknown>;
    };
    fieldRecordings: Array<{
        fieldName: string;
        value: unknown;
        /** Rendering hint for UI component (status, date, person, etc.) */
        renderHint?: string;
    }>;
}

export interface ItemClassification {
    itemTempId: string;
    outcome: 'FACT_EMITTED' | 'DERIVED_STATE' | 'INTERNAL_WORK' | 'EXTERNAL_WORK' | 'AMBIGUOUS' | 'UNCLASSIFIED';
    confidence: 'high' | 'medium' | 'low';
    rationale: string;
    emittedEvents?: Array<{ type: string; payload: unknown }>;
    candidates?: string[];
    resolution?: {
        resolvedOutcome: string;
        resolvedFactKind?: string;
        resolvedPayload?: Record<string, unknown>;
    };
    /** V2 interpretation plan with structured outputs */
    interpretationPlan?: InterpretationPlan;
    /** Schema matching result for definition selection */
    schemaMatch?: {
        definitionId: string | null;
        definitionName: string | null;
        matchScore: number;
        proposedDefinition?: {
            name: string;
            schemaConfig: { fields: Array<{ key: string; type: string; label: string }> };
        };
    };
}

/** Interpretation output variants */
export type InterpretationOutput =
    | { kind: 'fact_candidate'; factKind: string; payload?: Record<string, unknown>; confidence: 'low' | 'medium' | 'high' }
    | { kind: 'work_event'; eventType: 'WORK_STARTED' | 'WORK_FINISHED' | 'WORK_BLOCKED'; source?: string }
    | { kind: 'field_value'; field: string; value: unknown; confidence: 'low' | 'medium' | 'high' }
    | { kind: 'action_hint'; hintType: 'request' | 'prepare' | 'coordinate' | 'setup' | 'communicate'; text: string };

/** Interpretation plan from backend */
export interface InterpretationPlan {
    outputs: InterpretationOutput[];
    statusEvent?: InterpretationOutput;
    raw: {
        text: string;
        status?: string;
        targetDate?: string;
    };
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
    classifications: ItemClassification[];
}

export interface ImportExecutionResult {
    id: string;
    status: 'completed' | 'failed';
    createdIds: Record<string, string>;
    errors?: string[];
}

// ============================================================================
// CLASSIFICATION SUGGESTIONS
// ============================================================================

export interface ClassificationSuggestion {
    /** Rule ID that would match */
    ruleId: string;
    /** Source rule file (e.g., 'decision-rules', 'intent-mapping-rules') */
    ruleSource: string;
    /** Suggested fact kind (for fact_candidate rules) */
    factKind?: string;
    /** Human-readable label for the fact kind (inferred from text) */
    inferredLabel?: string;
    /** Suggested hint type (for action_hint rules) */
    hintType?: string;
    /** Confidence level */
    confidence: 'low' | 'medium' | 'high';
    /** Human-readable reason for suggestion */
    reason: string;
    /** Match score 0-100 (higher = better match) */
    matchScore: number;
    /** Output kind from the rule */
    outputKind: 'fact_candidate' | 'action_hint' | 'work_event' | 'field_value';
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch classification suggestions for UNCLASSIFIED items.
 */
export function useClassificationSuggestions(sessionId: string | null) {
    return useQuery({
        queryKey: ['classification-suggestions', sessionId],
        queryFn: async () => {
            const response = await api.get<{ suggestions: Record<string, ClassificationSuggestion[]> }>(
                `/imports/sessions/${sessionId}/suggestions`
            );
            return response.suggestions;
        },
        enabled: !!sessionId,
        staleTime: 30000, // 30 seconds - suggestions don't change often
    });
}

/**
 * Create a new import session.
 */
export function useCreateImportSession() {
    return useMutation({
        mutationFn: async (data: {
            parserName: string;
            rawData: string;
            config?: Record<string, unknown>;
        }) => {
            return api.post<ImportSession>('/imports/sessions', data);
        },
    });
}

/**
 * Get import session by ID.
 */
export function useImportSession(sessionId: string | null) {
    return useQuery({
        queryKey: ['import-session', sessionId],
        queryFn: async () => {
            return api.get<ImportSession>(`/imports/sessions/${sessionId}`);
        },
        enabled: !!sessionId,
    });
}

/**
 * Generate import plan for a session.
 */
export function useGenerateImportPlan() {
    return useMutation({
        mutationFn: async (sessionId: string) => {
            return api.post<ImportPlan>(`/imports/sessions/${sessionId}/plan`, {});
        },
    });
}

/**
 * Get import plan for a session.
 */
export function useImportPlan(sessionId: string | null) {
    return useQuery({
        queryKey: ['import-plan', sessionId],
        queryFn: async () => {
            return api.get<ImportPlan>(`/imports/sessions/${sessionId}/plan`);
        },
        enabled: !!sessionId,
    });
}

/**
 * Execute an import plan.
 */
export function useExecuteImport() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (sessionId: string) => {
            return api.post<ImportExecutionResult>(
                `/imports/sessions/${sessionId}/execute`,
                {}
            );
        },
        onSuccess: () => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['actions'] });
        },
    });
}

// ============================================================================
// RESOLUTION TYPES & HOOKS
// ============================================================================

export interface Resolution {
    itemTempId: string;
    resolvedOutcome: 'FACT_EMITTED' | 'DERIVED_STATE' | 'INTERNAL_WORK' | 'EXTERNAL_WORK' | 'AMBIGUOUS' | 'UNCLASSIFIED' | 'DEFERRED';
    resolvedFactKind?: string;
    resolvedPayload?: Record<string, unknown>;
}

/**
 * Save resolutions for classifications.
 * Updates the plan and recalculates session status.
 */
export function useSaveResolutions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ sessionId, resolutions }: {
            sessionId: string;
            resolutions: Resolution[];
        }) => {
            return api.patch<ImportPlan>(
                `/imports/sessions/${sessionId}/resolutions`,
                { resolutions }
            );
        },
        onSuccess: (_, { sessionId }) => {
            queryClient.invalidateQueries({ queryKey: ['import-plan', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['import-session', sessionId] });
        },
    });
}

// ============================================================================
// CONNECTOR SESSION HOOKS
// ============================================================================

/**
 * Create an import session from an external connector (Monday, etc.)
 * Returns both the session and generated plan in one call.
 */
export function useCreateConnectorSession() {
    return useMutation({
        mutationFn: async (data: {
            connectorType: 'monday';
            boardId: string;
            targetProjectId?: string;
        }) => {
            return api.post<{ session: ImportSession; plan: ImportPlan }>(
                '/imports/sessions/connector',
                data
            );
        },
    });
}

