/**
 * Interpretation API Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../queryKeys';
import type { InterpretationPlan } from './imports';

export interface InterpretationAvailability {
    available: boolean;
    outputCount: number;
}

export function useInterpretationAvailable(actionId: string | null) {
    return useQuery({
        queryKey: queryKeys.interpretation.available(actionId!),
        queryFn: async () => {
            if (!actionId) return { available: false, outputCount: 0 };
            return { available: true, outputCount: 5 } as InterpretationAvailability;
        },
        enabled: !!actionId,
        staleTime: 30000,
    });
}

export function useInterpretationPlan(actionId: string | null) {
    return useQuery({
        queryKey: queryKeys.interpretation.plan(actionId!),
        queryFn: async () => {
            const mockPlan: InterpretationPlan = {
                outputs: [
                    { kind: 'action_hint', hintType: 'request', text: 'Request meeting availability' },
                    { kind: 'action_hint', hintType: 'prepare', text: 'Prepare proposal document' },
                    { kind: 'fact_candidate', factKind: 'MEETING_HELD', confidence: 'low', payload: { subject: 'kickoff meeting' } },
                    { kind: 'fact_candidate', factKind: 'DOCUMENT_SUBMITTED', confidence: 'medium', payload: { documentType: 'ppap' } },
                    { kind: 'field_value', field: 'targetDate', value: '2026-01-15', confidence: 'high' },
                ],
                statusEvent: { kind: 'work_event', eventType: 'WORK_FINISHED', source: 'status' },
                raw: { text: '', status: 'completed' },
            };
            return mockPlan;
        },
        enabled: !!actionId,
    });
}

export function useApproveFactCandidate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ actionId, factIndex }: { actionId: string; factIndex: number }) => {
            void actionId; void factIndex;
            return { success: true };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.interpretation.plan(variables.actionId) });
        },
    });
}

export function useRejectFactCandidate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ actionId, factIndex, reason }: { actionId: string; factIndex: number; reason?: string }) => {
            void actionId; void factIndex; void reason;
            return { success: true };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.interpretation.plan(variables.actionId) });
        },
    });
}
