/**
 * BFA Sync Hooks
 *
 * TanStack Query hooks for BFA sync reconciliation API.
 * Backend routes: /api/programs/bfa/sync/*
 */

import type {
    BfaSyncDiffReport,
    BfaSyncDecisionRecord,
    BfaSubmitDecision,
    BfaApplyResult,
} from '@autoart/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../client';

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List recent sync diff reports across all board configs.
 */
export function useBfaSyncReports(limit = 20) {
    return useQuery({
        queryKey: ['bfa-sync', 'reports', { limit }],
        queryFn: async () => {
            return api.get<BfaSyncDiffReport[]>(
                `/programs/bfa/sync?limit=${limit}`
            );
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Get the most recent diff report for a specific board config.
 */
export function useBfaSyncReport(boardConfigId: string | null) {
    return useQuery({
        queryKey: ['bfa-sync', 'report', boardConfigId],
        queryFn: async () => {
            return api.get<BfaSyncDiffReport>(
                `/programs/bfa/sync/${boardConfigId}`
            );
        },
        enabled: !!boardConfigId,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * List decisions for a board config, with optional filters.
 */
export function useBfaDecisions(
    boardConfigId: string | null,
    reportId?: string,
    assignedTo?: string,
) {
    return useQuery({
        queryKey: ['bfa-sync', 'decisions', boardConfigId, { reportId, assignedTo }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (reportId) params.set('reportId', reportId);
            if (assignedTo) params.set('assignedTo', assignedTo);
            const qs = params.toString();
            return api.get<BfaSyncDecisionRecord[]>(
                `/programs/bfa/sync/${boardConfigId}/decisions${qs ? `?${qs}` : ''}`
            );
        },
        enabled: !!boardConfigId,
        staleTime: 1000 * 30, // 30 seconds
    });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Trigger a BFA sync diff computation.
 * Fetches current Monday data, compares against local state.
 */
export function useTriggerBfaSync() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ boardConfigId }: { boardConfigId: string }) => {
            return api.post<BfaSyncDiffReport>(
                '/programs/bfa/sync',
                { boardConfigId }
            );
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['bfa-sync', 'reports'] });
            queryClient.invalidateQueries({ queryKey: ['bfa-sync', 'report', variables.boardConfigId] });
            queryClient.invalidateQueries({ queryKey: ['bfa-sync', 'decisions', variables.boardConfigId] });
        },
    });
}

/**
 * Submit or update decisions for field changes.
 */
export function useSubmitBfaDecisions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ boardConfigId, decisions }: {
            boardConfigId: string;
            decisions: BfaSubmitDecision[];
        }) => {
            return api.post<BfaSyncDecisionRecord[]>(
                `/programs/bfa/sync/${boardConfigId}/decisions`,
                { decisions }
            );
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['bfa-sync', 'decisions', variables.boardConfigId] });
            queryClient.invalidateQueries({ queryKey: ['bfa-sync', 'report', variables.boardConfigId] });
        },
    });
}

/**
 * Apply accepted decisions to local entities.
 */
export function useApplyBfaDecisions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ boardConfigId }: { boardConfigId: string }) => {
            return api.post<BfaApplyResult>(
                `/programs/bfa/sync/${boardConfigId}/apply`,
                {}
            );
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['bfa-sync', 'decisions', variables.boardConfigId] });
            queryClient.invalidateQueries({ queryKey: ['bfa-sync', 'report', variables.boardConfigId] });
            // Also invalidate hierarchy/projects since apply modifies entities
            queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });
}
