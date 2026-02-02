import { useQuery } from '@tanstack/react-query';

import type { SearchResult } from '../../types';
import { api } from '../client';

// ==================== SEARCH ====================

export function useSearch(query: string, type?: string, enabled = true) {
  return useQuery({
    queryKey: ['search', query, type],
    queryFn: () => {
      const params = new URLSearchParams({ q: query || '' });
      return api.get<{ results: SearchResult[] }>(`/search/resolve?${params}`)
        .then(r => type ? r.results.filter(item => item.type === type) : r.results);
    },
    enabled,
    staleTime: 10000,
  });
}
