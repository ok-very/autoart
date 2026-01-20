/**
 * Action Types API Hooks
 *
 * React Query hooks for managing action type definitions.
 * Used by the Action Types Panel in the Registry.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../client';

// ==================== TYPES ====================

export interface ActionTypeFieldBinding {
    fieldKey: string;
    fieldType: 'string' | 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'user';
    label?: string;
    required?: boolean;
    defaultValue?: unknown;
    options?: string[];
}

export interface ActionTypeDefinition {
    id: string;
    type: string;
    label: string;
    description: string | null;
    field_bindings: ActionTypeFieldBinding[];
    defaults: Record<string, unknown>;
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

export interface ActionTypeStats {
    type: string;
    count: number;
}

export interface CreateActionTypeInput {
    type: string;
    label: string;
    description?: string;
    fieldBindings?: ActionTypeFieldBinding[];
    defaults?: Record<string, unknown>;
}

export interface UpdateActionTypeInput {
    label?: string;
    description?: string | null;
    fieldBindings?: ActionTypeFieldBinding[];
    defaults?: Record<string, unknown>;
}

// ==================== QUERIES ====================

/**
 * Fetch all action type definitions.
 */
export function useActionTypeDefinitions() {
    return useQuery({
        queryKey: ['actionTypes'],
        queryFn: () =>
            api.get<{ data: ActionTypeDefinition[] }>('/action-types').then((r) => r.data),
    });
}

/**
 * Fetch a single action type definition by type.
 */
export function useActionTypeDefinition(type: string | null) {
    return useQuery({
        queryKey: ['actionTypes', type],
        queryFn: () =>
            api
                .get<{ data: ActionTypeDefinition }>(`/action-types/${type}`)
                .then((r) => r.data),
        enabled: !!type,
    });
}

/**
 * Fetch action type usage stats.
 */
export function useActionTypeStats() {
    return useQuery({
        queryKey: ['actionTypes', 'stats'],
        queryFn: () =>
            api.get<{ data: ActionTypeStats[] }>('/action-types/stats').then((r) => r.data),
    });
}

// ==================== MUTATIONS ====================

/**
 * Create a new action type.
 */
export function useCreateActionType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateActionTypeInput) =>
            api.post<{ data: ActionTypeDefinition }>('/action-types', input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['actionTypes'] });
        },
    });
}

/**
 * Update an action type.
 */
export function useUpdateActionType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ type, input }: { type: string; input: UpdateActionTypeInput }) =>
            api.patch<{ data: ActionTypeDefinition }>(`/action-types/${type}`, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['actionTypes'] });
        },
    });
}

/**
 * Delete an action type.
 */
export function useDeleteActionType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (type: string) =>
            api.delete<{ success: boolean }>(`/action-types/${type}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['actionTypes'] });
        },
    });
}
