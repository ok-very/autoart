/**
 * Project Log API Hooks
 *
 * Hooks for fetching and managing the Project Log event stream.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../client';
import { queryKeys } from '../queryKeys';
import type { Event, ContextType } from '@autoart/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface EventsPageResponse {
  events: Event[];
  total: number;
  hasMore: boolean;
}

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
    queryKey: queryKeys.projectLog.events(contextId!, { includeSystem }),
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

export function useProjectLogEventCount(
  contextId: string | null,
  contextType: ContextType
) {
  return useQuery({
    queryKey: queryKeys.projectLog.eventCount(contextId!),
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
