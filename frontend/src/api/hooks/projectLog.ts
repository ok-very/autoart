/**
 * Project Log API Hooks
 *
 * Hooks for fetching and managing the Project Log event stream.
 * The Project Log is a chronological view of all events for a context.
 */

import { useQuery } from '@tanstack/react-query';

import type { Event, ContextType } from '@autoart/shared';

import { api } from '../client';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Response from the paginated events endpoint
 */
export interface EventsPageResponse {
  events: Event[];
  total: number;
  hasMore: boolean;
}

/**
 * Options for the project log events hook
 */
export interface UseProjectLogEventsOptions {
  contextId: string | null;
  contextType: ContextType;
  includeSystem?: boolean;
  types?: string[];
  actorId?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch paginated events for the Project Log
 *
 * Returns events in reverse chronological order (newest first).
 * System events are excluded by default.
 */
export function useProjectLogEvents(options: UseProjectLogEventsOptions) {
  const {
    contextId,
    contextType,
    includeSystem = false,
    types,
    actorId,
    limit = 50,
    offset = 0,
  } = options;

  return useQuery({
    queryKey: [
      'projectLog',
      contextId,
      contextType,
      { includeSystem, types, actorId, limit, offset },
    ],
    queryFn: async (): Promise<EventsPageResponse> => {
      if (!contextId) {
        return { events: [], total: 0, hasMore: false };
      }

      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      params.set('includeSystem', String(includeSystem));

      if (types && types.length > 0) {
        types.forEach((t) => params.append('types', t));
      }
      if (actorId) {
        params.set('actorId', actorId);
      }

      return api.get<EventsPageResponse>(
        `/events/context/${contextType}/${contextId}?${params.toString()}`
      );
    },
    enabled: !!contextId,
  });
}

/**
 * Get event count for a context (useful for showing total events)
 */
export function useProjectLogEventCount(
  contextId: string | null,
  contextType: ContextType
) {
  return useQuery({
    queryKey: ['projectLog', 'count', contextId, contextType],
    queryFn: async () => {
      if (!contextId) return 0;

      const result = await api.get<EventsPageResponse>(
        `/events/context/${contextType}/${contextId}?limit=0`
      );
      return result.total;
    },
    enabled: !!contextId,
  });
}
