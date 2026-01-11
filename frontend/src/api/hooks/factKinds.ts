/**
 * Fact Kinds API Hooks
 *
 * React Query hooks for managing fact kind definitions.
 * Used by the Definition Review UI.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// ==================== TYPES ====================

export interface FactKindDefinition {
    id: string;
    fact_kind: string;
    display_name: string;
    description: string | null;
    payload_schema: unknown;
    example_payload: unknown | null;
    source: string;
    confidence: string;
    needs_review: boolean;
    is_known: boolean;
    first_seen_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
}

export interface FactKindStats {
    total: number;
    needsReview: number;
    known: number;
}

// ==================== QUERIES ====================

/**
 * Fetch all fact kind definitions, optionally filtered.
 */
export function useFactKindDefinitions(filters?: {
    needsReview?: boolean;
    source?: string;
}) {
    const params = new URLSearchParams();
    if (filters?.needsReview !== undefined) {
        params.set('needsReview', String(filters.needsReview));
    }
    if (filters?.source) {
        params.set('source', filters.source);
    }

    const queryString = params.toString();
    const url = queryString ? `/fact-kinds?${queryString}` : '/fact-kinds';

    return useQuery({
        queryKey: ['factKinds', filters],
        queryFn: () =>
            api.get<{ data: FactKindDefinition[] }>(url).then((r) => r.data),
    });
}

/**
 * Fetch fact kinds that need review.
 */
export function useFactKindsNeedingReview() {
    return useFactKindDefinitions({ needsReview: true });
}

/**
 * Fetch fact kind stats (total, needsReview, known counts).
 */
export function useFactKindStats() {
    return useQuery({
        queryKey: ['factKinds', 'stats'],
        queryFn: () => api.get<FactKindStats>('/fact-kinds/stats'),
    });
}

/**
 * Fetch a single fact kind definition.
 */
export function useFactKindDefinition(factKind: string | null) {
    return useQuery({
        queryKey: ['factKinds', factKind],
        queryFn: () =>
            api
                .get<{ data: FactKindDefinition }>(`/fact-kinds/${factKind}`)
                .then((r) => r.data),
        enabled: !!factKind,
    });
}

// ==================== MUTATIONS ====================

/**
 * Approve a fact kind definition (mark as known).
 */
export function useApproveFactKind() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            factKind,
            reviewerId,
        }: {
            factKind: string;
            reviewerId?: string;
        }) =>
            api.post<{ data: FactKindDefinition }>(`/fact-kinds/${factKind}/approve`, {
                reviewerId,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['factKinds'] });
        },
    });
}

/**
 * Deprecate a fact kind definition.
 */
export function useDeprecateFactKind() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            factKind,
            reviewerId,
        }: {
            factKind: string;
            reviewerId?: string;
        }) =>
            api.post<{ data: FactKindDefinition }>(
                `/fact-kinds/${factKind}/deprecate`,
                { reviewerId }
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['factKinds'] });
        },
    });
}

/**
 * Merge one fact kind into another.
 */
export function useMergeFactKinds() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            sourceFactKind,
            targetFactKind,
            reviewerId,
        }: {
            sourceFactKind: string;
            targetFactKind: string;
            reviewerId?: string;
        }) =>
            api.post<{ source: FactKindDefinition; target: FactKindDefinition }>(
                `/fact-kinds/${sourceFactKind}/merge`,
                { targetFactKind, reviewerId }
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['factKinds'] });
        },
    });
}
