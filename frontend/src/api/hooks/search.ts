import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { SearchResult } from '../../types';

// ==================== SEARCH ====================

export function useSearch(query: string, projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['search', query, projectId],
    queryFn: () => {
      const params = new URLSearchParams({ q: query || '' });
      if (projectId) params.set('projectId', projectId);
      return api.get<{ results: SearchResult[] }>(`/search/resolve?${params}`).then(r => r.results);
    },
    enabled,
    staleTime: 10000,
  });
}
