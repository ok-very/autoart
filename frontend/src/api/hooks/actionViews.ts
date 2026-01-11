/**
 * Action Views API Hooks
 *
 * Hooks for fetching interpreted ActionViews (non-reified projections).
 * These views are derived from the event log and are never stored.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type {
    ActionView,
    ActionViewType,
    DerivedStatus,
    ContextType,
} from '@autoart/shared';

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
        queryKey: ['actionViews', contextType, contextId, view, status],
        queryFn: () => {
            const params = new URLSearchParams();
            params.set('view', view);
            if (status) params.set('status', status);

            // Determine endpoint based on context type
            // Currently supporting hierarchy levels: subprocess, stage, process
            // Project level might be added later
            let endpoint = '';
            if (['subprocess', 'stage', 'process'].includes(contextType)) {
                endpoint = `/hierarchy/${contextType}/${contextId}/action-views`;
            } else {
                // Fallback or other contexts if implemented
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
 * This uses the backend interpretation endpoint
 */
export function useActionView(actionId: string | null) {
    return useQuery({
        queryKey: ['actionView', actionId],
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
        queryKey: ['actionViews', 'summary', contextType, contextId],
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
