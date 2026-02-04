import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Poll, CreatePollInput, UpdatePollInput, DuplicatePollInput } from '@autoart/shared';
import { api } from '../client';

export const POLLS_QUERY_KEY = ['polls'] as const;

/** Poll results from authenticated endpoint */
export interface PollResults {
  poll: Poll;
  slotCounts: Record<string, number>;
  bestSlots: string[];
  totalResponses: number;
}

export function usePolls() {
  return useQuery({
    queryKey: POLLS_QUERY_KEY,
    queryFn: () =>
      api.get<{ polls: Poll[] }>('/polls').then((r) => r.polls),
  });
}

export function useCreatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePollInput) =>
      api.post<{ poll: Poll }>('/polls', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLLS_QUERY_KEY });
    },
  });
}

export function useClosePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ poll: Poll }>(`/polls/${id}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLLS_QUERY_KEY });
    },
  });
}

export function useUpdatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdatePollInput }) =>
      api.patch<{ poll: Poll }>(`/polls/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLLS_QUERY_KEY });
    },
  });
}

export function useDeletePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/polls/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLLS_QUERY_KEY });
    },
  });
}

export function useDuplicatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: DuplicatePollInput }) =>
      api.post<{ poll: Poll }>(`/polls/${id}/duplicate`, input ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLLS_QUERY_KEY });
    },
  });
}

export function usePollResults(pollId: string | null) {
  return useQuery({
    queryKey: ['poll', pollId, 'results'],
    queryFn: () =>
      api.get<{ results: PollResults }>(`/polls/${pollId}/results`).then((r) => r.results),
    enabled: !!pollId,
  });
}
