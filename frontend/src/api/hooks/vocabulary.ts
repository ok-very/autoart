/**
 * Vocabulary Hooks
 *
 * Frontend hooks for fetching action vocabulary suggestions.
 * The backend endpoint (GET /api/vocabulary/suggestions) returns
 * verb/noun/adjective triples ordered by frequency.
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '../client';

// ============================================================================
// TYPES
// ============================================================================

export interface VocabularySuggestion {
    verb: string;
    noun: string;
    adjective: string | null;
    frequency: number;
}

interface VocabularySuggestionsResponse {
    suggestions: VocabularySuggestion[];
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch vocabulary suggestions for a given prefix.
 *
 * Disabled until prefix is at least 2 characters.
 * Results cached for 10 minutes.
 */
export function useVocabularySuggestions(
    prefix: string,
    options?: { limit?: number },
) {
    return useQuery({
        queryKey: ['vocabulary-suggestions', prefix, options?.limit],
        queryFn: async () => {
            const params = new URLSearchParams({ prefix });
            if (options?.limit) params.set('limit', String(options.limit));
            const response = await api.get<VocabularySuggestionsResponse>(
                `/vocabulary/suggestions?${params}`,
            );
            return response.suggestions;
        },
        enabled: prefix.length >= 2,
        staleTime: 10 * 60 * 1000,
        retry: false,
    });
}
