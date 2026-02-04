import { useQuery } from '@tanstack/react-query';

import type { SearchResult } from '../../types';
import { api } from '../client';

// ==================== SEARCH ====================

interface UseSearchOptions {
  projectId?: string;
  type?: string;
}

export function useSearch(query: string, options?: UseSearchOptions | string, enabled = true) {
  // Existing callers pass projectId as second arg (treating string as projectId)
  const opts: UseSearchOptions = typeof options === 'string'
    ? { projectId: options }
    : (options ?? {});

  return useQuery({
    queryKey: ['search', query, opts.projectId, opts.type],
    queryFn: () => {
      const params = new URLSearchParams({ q: query || '' });
      if (opts.projectId) params.set('projectId', opts.projectId);
      return api.get<{ results: SearchResult[] }>(`/search/resolve?${params}`)
        .then(r => opts.type ? r.results.filter(item => item.type === opts.type) : r.results);
    },
    enabled,
    staleTime: 10000,
  });
}
