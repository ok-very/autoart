/**
 * Interpretation API Hooks
 *
 * Hooks for the interpretation inspector:
 * - Fetch interpretation plan for an action/record
 * - Check if interpretation is available
 * - Approve/reject fact candidates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { api } from '../client'; // TODO: Uncomment when backend endpoints are ready

// ============================================================================
// TYPES
// ============================================================================

export interface InterpretationOutput {
    kind: 'fact_candidate' | 'action_hint' | 'work_event' | 'field_value';
    [key: string]: unknown;
}

export interface InterpretationPlan {
    outputs: InterpretationOutput[];
    statusEvent?: InterpretationOutput;
    raw?: unknown;
}

export interface InterpretationAvailability {
    available: boolean;
    outputCount: number;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Check if interpretation data is available for an action
 * This is a lightweight check used for tab gating
 */
export function useInterpretationAvailable(actionId: string | null) {
    return useQuery({
        queryKey: ['interpretation', 'available', actionId],
        queryFn: async () => {
            // TODO: Replace with actual API call when backend is ready
            // For now, return mock data based on whether actionId exists
            // Real implementation: api.get<InterpretationAvailability>(`/actions/${actionId}/interpretation/available`)
            if (!actionId) return { available: false, outputCount: 0 };

            // Simulate API check - in reality this would hit the backend
            return { available: true, outputCount: 5 } as InterpretationAvailability;
        },
        enabled: !!actionId,
        staleTime: 30000, // Cache for 30 seconds
    });
}

/**
 * Get the full interpretation plan for an action
 */
export function useInterpretationPlan(actionId: string | null) {
    return useQuery({
        queryKey: ['interpretation', 'plan', actionId],
        queryFn: async () => {
            // TODO: Replace with actual API call when backend is ready
            // Real implementation: api.get<{ plan: InterpretationPlan }>(`/actions/${actionId}/interpretation`)

            // Mock data for now
            const mockPlan: InterpretationPlan = {
                outputs: [
                    { kind: 'action_hint', hintType: 'request', text: 'Request meeting availability' },
                    { kind: 'action_hint', hintType: 'prepare', text: 'Prepare proposal document' },
                    { kind: 'fact_candidate', factKind: 'MEETING_HELD', confidence: 'low', payload: { subject: 'kickoff meeting' } },
                    { kind: 'fact_candidate', factKind: 'DOCUMENT_SUBMITTED', confidence: 'medium', payload: { documentType: 'ppap' } },
                    { kind: 'field_value', field: 'targetDate', value: '2026-01-15' },
                ],
                statusEvent: { kind: 'work_event', eventType: 'WORK_FINISHED', source: 'status' },
            };
            return mockPlan;
        },
        enabled: !!actionId,
    });
}

/**
 * Approve a fact candidate from interpretation
 */
export function useApproveFactCandidate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ actionId, factIndex }: { actionId: string; factIndex: number }) => {
            // TODO: Replace with actual API call
            // Real implementation: api.post(`/actions/${actionId}/interpretation/approve`, { factIndex })
            void actionId; void factIndex; // Suppress unused warnings until API is ready
            return { success: true };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['interpretation', 'plan', variables.actionId] });
        },
    });
}

/**
 * Reject a fact candidate from interpretation
 */
export function useRejectFactCandidate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ actionId, factIndex, reason }: { actionId: string; factIndex: number; reason?: string }) => {
            // TODO: Replace with actual API call
            // Real implementation: api.post(`/actions/${actionId}/interpretation/reject`, { factIndex, reason })
            void actionId; void factIndex; void reason; // Suppress unused warnings until API is ready
            return { success: true };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['interpretation', 'plan', variables.actionId] });
        },
    });
}
