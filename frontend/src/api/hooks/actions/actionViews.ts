/**
 * Action Views API Hooks
 *
 * Hooks for fetching interpreted ActionViews (non-reified projections).
 * These views are derived from the event log and are never stored.
 */

import { useQuery } from '@tanstack/react-query';

import type {
    ActionView,
    ActionViewType,
    DerivedStatus,
    ContextType,
} from '@autoart/shared';

import { api } from '../../client';
import { queryKeys } from '../../queryKeys';

// ============================================================================
// ACTION VIEWS
// ============================================================================

/**
 * Get interpreted ActionViews for a specific context (subprocess, stage, process)
 */
export function useActionViews(
    contextId: string | null,
    contextType: ContextType,
    options?: {
        view?: ActionViewType;
        status?: DerivedStatus;
    }
) {
    const { view = 'task-like', status } = options || {};

    return useQuery({
        queryKey: queryKeys.actionViews.byContext(contextId!, contextType, view, status),
        queryFn: () => {
            const params = new URLSearchParams();
            params.set('view', view);
            if (status) params.set('status', status);

            let endpoint = '';
            if (['subprocess', 'stage', 'process'].includes(contextType)) {
                endpoint = `/hierarchy/${contextType}/${contextId}/action-views`;
            } else {
                throw new Error(`Unsupported context type for action views: ${contextType}`);
            }

            return api
                .get<{ views: ActionView[] }>(`${endpoint}?${params}`)
                .then((r) => r.views);
        },
        enabled: !!contextId && !!contextType,
    });
}

/**
 * Get a single action view by action ID
 */
export function useActionView(actionId: string | null) {
    return useQuery({
        queryKey: queryKeys.actionViews.detail(actionId!),
        queryFn: () =>
            api
                .get<{ view: ActionView }>(`/actions/${actionId}/view`)
                .then((r) => r.view),
        enabled: !!actionId,
    });
}

/**
 * Get status summary for a context
 */
export function useActionViewsSummary(
    contextId: string | null,
    contextType: ContextType
) {
    return useQuery({
        queryKey: queryKeys.actionViews.summary(contextId!, contextType),
        queryFn: () => {
            let endpoint = '';
            if (['subprocess', 'stage', 'process'].includes(contextType)) {
                endpoint = `/hierarchy/${contextType}/${contextId}/action-views/summary`;
            } else {
                throw new Error(`Unsupported context type for action views summary: ${contextType}`);
            }

            return api
                .get<{ summary: Record<DerivedStatus, number> }>(endpoint)
                .then((r) => r.summary);
        },
        enabled: !!contextId && !!contextType,
    });
}
