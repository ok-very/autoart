import { useQuery } from '@tanstack/react-query';

import type { SearchResult } from '../../types';
import { api } from '../client';

// ==================== SEARCH ====================

/**
 * Search for records and nodes.
 * @param query - Search query string
 * @param projectId - Optional project ID to scope results (pass undefined to search all)
 * @param enabled - Whether the query is enabled
 */
export function useSearch(query: string, projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['search', query, projectId],
    queryFn: () => {
      const params = new URLSearchParams({ q: query || '' });
      if (projectId) params.set('projectId', projectId);
      return api.get<{ results: SearchResult[] }>(`/search/resolve?${params}`)
        .then(r => r.results);
    },
    enabled,
    staleTime: 10000,
  });
}
