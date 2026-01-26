/**
 * Composer API Hooks
 *
 * Hooks for the Composer module - the Task Builder on top of Actions + Events.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type {
    ComposerInput,
    ComposerResponse,
} from '@autoart/shared';

import { api } from '../../client';
import { queryKeys } from '../../queryKeys';

// ============================================================================
// FULL COMPOSER
// ============================================================================

export function useCompose() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ComposerInput) =>
            api.post<ComposerResponse>('/composer', data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.actionViews.byContext(result.action.contextId, result.action.contextType),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.actions.byContext(result.action.contextId, result.action.contextType),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.actions.byType(result.action.type),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.actions.all(),
                exact: false,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.events.byContext(result.action.contextId, result.action.contextType),
            });
        },
    });
}
