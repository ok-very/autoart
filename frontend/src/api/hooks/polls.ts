/**
 * Polls module React Query hooks
 * Authenticated dashboard hooks for poll management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../client';
import type { Poll, PollTimeConfig } from '@autoart/shared';

interface PollWithResponses extends Poll {
  responses: Array<{
    id: string;
    poll_id: string;
    participant_name: string;
    participant_email: string | null;
    available_slots: string[];
    created_at: string;
    updated_at: string;
  }>;
}

interface PollResultsData {
  poll: Poll;
  slotCounts: Record<string, number>;
  bestSlots: string[];
  totalResponses: number;
}

export const pollsQueryKeys = {
  all: () => ['polls'] as const,
  list: () => ['polls', 'list'] as const,
  detail: (id: string) => ['polls', 'detail', id] as const,
  results: (uniqueId: string) => ['polls', 'results', uniqueId] as const,
  engagements: (id: string) => ['polls', 'engagements', id] as const,
};

/**
 * Fetch all polls for the current user
 */
export function usePolls() {
  return useQuery({
    queryKey: pollsQueryKeys.list(),
    queryFn: async () => {
      const data = await api.get<{ polls: Poll[] }>('/polls');
      return data.polls;
    },
    staleTime: 30000,
  });
}

/**
 * Fetch a single poll by ID with responses (owner-only)
 */
export function usePoll(id: string | null) {
  return useQuery({
    queryKey: pollsQueryKeys.detail(id || ''),
    queryFn: async () => {
      const data = await api.get<{ poll: PollWithResponses }>(`/polls/${id}`);
      return data.poll;
    },
    enabled: !!id,
  });
}

/**
 * Create a new poll
 */
export function useCreatePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      time_config: PollTimeConfig;
      project_id?: string;
    }) => {
      const data = await api.post<{ poll: Poll }>('/polls', input);
      return data.poll;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pollsQueryKeys.all() });
    },
  });
}

/**
 * Close a poll (owner-only)
 */
export function useClosePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const data = await api.post<{ poll: Poll }>(`/polls/${id}/close`);
      return data.poll;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pollsQueryKeys.all() });
    },
  });
}

/**
 * Fetch aggregated results for a poll by uniqueId (public endpoint)
 */
export function usePollResults(uniqueId: string | null) {
  return useQuery({
    queryKey: pollsQueryKeys.results(uniqueId || ''),
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/public/poll/${uniqueId}/results`
      );
      if (!res.ok) throw new Error('Failed to load results');
      const data = await res.json();
      return data.results as PollResultsData;
    },
    enabled: !!uniqueId,
  });
}
