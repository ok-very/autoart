import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { TaskReference, ResolvedReference } from '../../types';

// ==================== REFERENCES ====================
// Procedural operations for static/dynamic reference management

export function useTaskReferences(taskId: string | null) {
  return useQuery({
    queryKey: ['references', taskId],
    queryFn: () => api.get<{ references: TaskReference[] }>(`/references/task/${taskId}`).then(r => r.references),
    enabled: !!taskId,
  });
}

export function useCreateReference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { taskId: string; sourceRecordId: string; targetFieldKey: string; mode?: 'static' | 'dynamic' }) =>
      api.post<{ reference: TaskReference }>('/references', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
    },
  });
}

export function useDeleteReference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/references/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['reference'] });
    },
  });
}

export function useUpdateReferenceMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: 'static' | 'dynamic' }) =>
      api.patch<{ reference: TaskReference }>(`/references/${id}/mode`, { mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
    },
  });
}

export function useUpdateReferenceSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: unknown }) =>
      api.patch<{ reference: TaskReference }>(`/references/${id}/snapshot`, { value }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['reference', variables.id] });
    },
  });
}

export function useResolveReference(referenceId: string | null) {
  return useQuery({
    queryKey: ['reference', referenceId],
    queryFn: () => api.get<{ resolved: ResolvedReference }>(`/references/${referenceId}/resolve`).then(r => r.resolved),
    enabled: !!referenceId,
    staleTime: 5000,
  });
}

export function useCheckDrift(referenceId: string | null) {
  return useQuery({
    queryKey: ['reference', referenceId, 'drift'],
    queryFn: () => api.get<{ drift: boolean; liveValue: unknown; snapshotValue: unknown }>(`/references/${referenceId}/drift`),
    enabled: false, // Manual trigger
  });
}

export function useResolveReferences() {
  return useMutation({
    mutationFn: (referenceIds: string[]) =>
      api.post<Record<string, ResolvedReference>>('/references/resolve', { referenceIds }),
  });
}
