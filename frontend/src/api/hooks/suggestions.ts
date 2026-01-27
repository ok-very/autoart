/**
 * Suggestions Hooks
 *
 * Frontend hooks for fetching context-aware suggestions.
 * Suggestions help users discover relevant actions, links, and patterns.
 *
 * Suggestion types:
 * - link: "Link to Record X?"
 * - similar: "Similar to Action Y from yesterday?"
 * - action: "Create task for this?"
 * - reference: "Add reference to Record Z?"
 */

import { useQuery } from '@tanstack/react-query';

import type { ContextType } from '@autoart/shared';

import { api } from '../client';

// ============================================================================
// TYPES
// ============================================================================

export type SuggestionType = 'link' | 'similar' | 'action' | 'reference';

export interface Suggestion {
    id: string;
    type: SuggestionType;
    title: string;
    description: string;
    /** Confidence score 0-1 */
    confidence: number;
    /** Entity to link/reference */
    targetEntityId?: string;
    targetEntityType?: 'action' | 'record' | 'email';
    targetEntityTitle?: string;
    /** Metadata for the suggestion */
    metadata?: Record<string, unknown>;
}

export interface SuggestionsResponse {
    suggestions: Suggestion[];
    contextId: string;
    contextType: ContextType;
}

export interface ComposerSuggestionsInput {
    /** Partial title being typed */
    title?: string;
    /** Current context */
    contextId: string;
    contextType: ContextType;
    /** Parent action (for subtasks) */
    parentActionId?: string;
}

export interface EmailSuggestionsInput {
    /** Email ID */
    emailId: string;
    /** Email subject */
    subject?: string;
    /** Email body preview */
    bodyPreview?: string;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch suggestions for the composer based on partial input
 */
export function useComposerSuggestions(input: ComposerSuggestionsInput | null) {
    // Use stable primitives for queryKey to avoid cache churn
    const queryKey = [
        'suggestions',
        'composer',
        input?.contextId ?? null,
        input?.contextType ?? null,
        input?.title?.slice(0, 50) ?? null, // Truncate title for stability
        input?.parentActionId ?? null,
    ];

    return useQuery({
        queryKey,
        queryFn: async (): Promise<Suggestion[]> => {
            if (!input || !input.contextId) return [];

            try {
                const response = await api.post<SuggestionsResponse>(
                    '/suggestions/composer',
                    input
                );
                return response.suggestions;
            } catch {
                // Return empty array if suggestions endpoint not available
                return [];
            }
        },
        enabled: !!input?.contextId,
        staleTime: 10000, // Suggestions can be cached briefly
        retry: false, // Don't retry suggestions - they're not critical
    });
}

/**
 * Fetch suggestions based on email content
 */
export function useEmailSuggestions(input: EmailSuggestionsInput | null) {
    return useQuery({
        queryKey: ['suggestions', 'email', input?.emailId],
        queryFn: async (): Promise<Suggestion[]> => {
            if (!input) return [];

            try {
                const response = await api.post<SuggestionsResponse>(
                    '/suggestions/email',
                    input
                );
                return response.suggestions;
            } catch {
                return [];
            }
        },
        enabled: !!input?.emailId,
        staleTime: 30000,
        retry: false,
    });
}

/**
 * Fetch suggestions for an action (similar actions, potential links)
 */
export function useActionSuggestions(actionId: string | null) {
    return useQuery({
        queryKey: ['suggestions', 'action', actionId],
        queryFn: async (): Promise<Suggestion[]> => {
            if (!actionId) return [];

            try {
                const response = await api.get<SuggestionsResponse>(
                    `/suggestions/action/${actionId}`
                );
                return response.suggestions;
            } catch {
                return [];
            }
        },
        enabled: !!actionId,
        staleTime: 30000,
        retry: false,
    });
}

/**
 * Fetch context-level suggestions (orphan detection, process suggestions)
 */
export function useContextSuggestions(
    contextId: string | null,
    contextType: ContextType
) {
    return useQuery({
        queryKey: ['suggestions', 'context', contextId, contextType],
        queryFn: async (): Promise<Suggestion[]> => {
            if (!contextId) return [];

            try {
                const response = await api.get<SuggestionsResponse>(
                    `/suggestions/context/${contextType}/${contextId}`
                );
                return response.suggestions;
            } catch {
                return [];
            }
        },
        enabled: !!contextId,
        staleTime: 60000,
        retry: false,
    });
}

// ============================================================================
// MOCK SUGGESTIONS (for development/demo)
// ============================================================================

/**
 * Generate mock suggestions based on title input
 * Used when backend suggestions endpoint is not available
 */
export function generateMockComposerSuggestions(
    title: string,
    _contextId: string
): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Similar action suggestion
    if (title.length > 3) {
        suggestions.push({
            id: 'mock-similar-1',
            type: 'similar',
            title: 'Similar to yesterday',
            description: `Similar to "Review ${title.slice(0, 10)}..." from yesterday`,
            confidence: 0.75,
            targetEntityId: 'mock-action-1',
            targetEntityType: 'action',
            targetEntityTitle: `Review ${title.slice(0, 10)}...`,
        });
    }

    // Link suggestion based on keywords
    const keywords = ['permit', 'contract', 'review', 'document', 'email'];
    const matchedKeyword = keywords.find((k) =>
        title.toLowerCase().includes(k)
    );

    if (matchedKeyword) {
        suggestions.push({
            id: 'mock-link-1',
            type: 'link',
            title: `Link to ${matchedKeyword}?`,
            description: `Found a ${matchedKeyword} record that might be related`,
            confidence: 0.65,
            targetEntityId: 'mock-record-1',
            targetEntityType: 'record',
            targetEntityTitle: `${matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1)} Application`,
        });
    }

    return suggestions;
}

/**
 * Generate mock email suggestions
 */
export function generateMockEmailSuggestions(
    subject: string,
    _bodyPreview?: string
): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Action creation suggestion
    suggestions.push({
        id: 'mock-action-1',
        type: 'action',
        title: 'Create task?',
        description: `Create a task to follow up on "${subject.slice(0, 30)}..."`,
        confidence: 0.8,
    });

    // Deadline detection
    if (subject.toLowerCase().includes('deadline') || subject.toLowerCase().includes('due')) {
        suggestions.push({
            id: 'mock-action-2',
            type: 'action',
            title: 'Deadline detected',
            description: 'This email mentions a deadline - create a reminder?',
            confidence: 0.9,
        });
    }

    return suggestions;
}
