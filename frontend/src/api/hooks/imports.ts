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
    }>;
}

export interface ItemClassification {
    itemTempId: string;
    outcome: 'FACT_EMITTED' | 'DERIVED_STATE' | 'INTERNAL_WORK' | 'AMBIGUOUS' | 'UNCLASSIFIED';
    confidence: 'high' | 'medium' | 'low';
    rationale: string;
    emittedEvents?: Array<{ type: string; payload: unknown }>;
    candidates?: string[];
    resolution?: {
        resolvedOutcome: string;
        resolvedFactKind?: string;
        resolvedPayload?: Record<string, unknown>;
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
// HOOKS
// ============================================================================

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
