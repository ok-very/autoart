/**
 * Action References Hooks
 *
 * Frontend hooks for managing action-to-record references.
 * Uses TanStack Query for data fetching and mutations.
 *
 * Note: All mutations emit events via the API. The projector
 * updates the snapshot table synchronously, so refetching
 * immediately after mutation returns fresh data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { AddActionReferenceInput, RemoveActionReferenceInput, Event } from '@autoart/shared';

import { api } from '../client';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Action reference from the snapshot table
 */
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

/**
 * Fetch all references for an action.
 * Reads from the snapshot table (fast, consistent).
 */
export function useActionReferences(actionId: string | null) {
    return useQuery({
        queryKey: ['actionReferences', actionId],
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

/**
 * Add a reference to an action.
 * Emits ACTION_REFERENCE_ADDED event.
 */
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
            // Invalidate references for this action
            queryClient.invalidateQueries({
                queryKey: ['actionReferences', variables.actionId],
            });
        },
    });
}

/**
 * Remove a reference from an action.
 * Emits ACTION_REFERENCE_REMOVED event.
 */
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
            // Invalidate references for this action
            queryClient.invalidateQueries({
                queryKey: ['actionReferences', variables.actionId],
            });
        },
    });
}

// ============================================================================
// BULK OPERATIONS (Preferred for Composer)
// ============================================================================

/**
 * Input for a single reference in bulk operations
 */
export interface ReferenceInput {
    sourceRecordId: string;
    targetFieldKey: string;
    snapshotValue?: unknown;
}

/**
 * Response from bulk set operation
 */
interface SetReferencesResponse {
    references: ActionReference[];
    added: number;
    removed: number;
}

/**
 * Bulk replace all references for an action.
 * Diffs old → new and emits minimal add/remove events.
 * This is the preferred mutation for the Composer.
 */
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
            // Invalidate references for this action
            queryClient.invalidateQueries({
                queryKey: ['actionReferences', variables.actionId],
            });
            // Invalidate action views (references may affect display)
            queryClient.invalidateQueries({
                queryKey: ['actionViews'],
            });
        },
    });
}
