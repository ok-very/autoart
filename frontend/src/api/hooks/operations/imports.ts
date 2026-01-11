/**
 * Import Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../client';
import { queryKeys } from '../queryKeys';

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
    interpretationPlan?: InterpretationPlan;
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

export type InterpretationOutput =
    | { kind: 'fact_candidate'; factKind: string; payload?: Record<string, unknown>; confidence: 'low' | 'medium' | 'high' }
    | { kind: 'work_event'; eventType: 'WORK_STARTED' | 'WORK_FINISHED' | 'WORK_BLOCKED'; source?: string }
    | { kind: 'field_value'; field: string; value: unknown; confidence: 'low' | 'medium' | 'high' }
    | { kind: 'action_hint'; hintType: 'request' | 'prepare' | 'coordinate' | 'setup' | 'communicate'; text: string };

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

export interface ClassificationSuggestion {
    ruleId: string;
    ruleSource: string;
    factKind?: string;
    inferredLabel?: string;
    hintType?: string;
    confidence: 'low' | 'medium' | 'high';
    reason: string;
    matchScore: number;
    outputKind: 'fact_candidate' | 'action_hint' | 'work_event' | 'field_value';
}

export interface Resolution {
    itemTempId: string;
    resolvedOutcome: 'FACT_EMITTED' | 'DERIVED_STATE' | 'INTERNAL_WORK' | 'EXTERNAL_WORK' | 'AMBIGUOUS' | 'UNCLASSIFIED' | 'DEFERRED';
    resolvedFactKind?: string;
    resolvedPayload?: Record<string, unknown>;
}

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
        staleTime: 30000,
    });
}

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

export function useImportSession(sessionId: string | null) {
    return useQuery({
        queryKey: queryKeys.imports.batch(sessionId!),
        queryFn: async () => {
            return api.get<ImportSession>(`/imports/sessions/${sessionId}`);
        },
        enabled: !!sessionId,
    });
}

export function useGenerateImportPlan() {
    return useMutation({
        mutationFn: async (sessionId: string) => {
            return api.post<ImportPlan>(`/imports/sessions/${sessionId}/plan`, {});
        },
    });
}

export function useImportPlan(sessionId: string | null) {
    return useQuery({
        queryKey: ['import-plan', sessionId],
        queryFn: async () => {
            return api.get<ImportPlan>(`/imports/sessions/${sessionId}/plan`);
        },
        enabled: !!sessionId,
    });
}

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
            queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.projects() });
            queryClient.invalidateQueries({ queryKey: queryKeys.actions.all() });
        },
    });
}

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
            queryClient.invalidateQueries({ queryKey: queryKeys.imports.batch(sessionId) });
        },
    });
}

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
