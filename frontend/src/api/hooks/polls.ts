import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Poll, CreatePollInput } from '@autoart/shared';
import { api } from '../client';

export const POLLS_QUERY_KEY = ['polls'] as const;

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
