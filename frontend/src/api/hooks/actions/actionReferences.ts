/**
 * Action References Hooks
 *
 * Frontend hooks for managing action-to-record references.
 * Uses TanStack Query for data fetching and mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { AddActionReferenceInput, RemoveActionReferenceInput, Event } from '@autoart/shared';

import { api } from '../../client';
import { queryKeys } from '../../queryKeys';

// ============================================================================
// TYPES
// ============================================================================

export interface ActionReference {
    id: string;
    action_id: string;
    source_record_id: string | null;
    target_field_key: string | null;
    mode: 'static' | 'dynamic';
    snapshot_value: unknown;
    created_at: string;
}

// ============================================================================
// QUERIES
// ============================================================================

export function useActionReferences(actionId: string | null) {
    return useQuery({
        queryKey: queryKeys.actionReferences.byAction(actionId!),
        queryFn: () =>
            api
                .get<{ references: ActionReference[] }>(`/actions/${actionId}/references`)
                .then((r) => r.references),
        enabled: !!actionId,
    });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useAddActionReference() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            actionId,
            input,
        }: {
            actionId: string;
            input: AddActionReferenceInput;
        }) =>
            api.post<{ event: Event }>(`/actions/${actionId}/references`, input),

        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.actionReferences.byAction(variables.actionId),
            });
        },
    });
}

export function useRemoveActionReference() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            actionId,
            input,
        }: {
            actionId: string;
            input: RemoveActionReferenceInput;
        }) =>
            api.post<{ event: Event }>(`/actions/${actionId}/references/remove`, input),

        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.actionReferences.byAction(variables.actionId),
            });
        },
    });
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export interface ReferenceInput {
    sourceRecordId: string;
    targetFieldKey: string;
    snapshotValue?: unknown;
}

interface SetReferencesResponse {
    references: ActionReference[];
    added: number;
    removed: number;
}

export function useSetActionReferences() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            actionId,
            references,
        }: {
            actionId: string;
            references: ReferenceInput[];
        }) =>
            api.put<SetReferencesResponse>(`/actions/${actionId}/references`, { references }),

        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.actionReferences.byAction(variables.actionId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.actionViews.all(),
            });
        },
    });
}
