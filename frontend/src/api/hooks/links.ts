import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// ==================== RECORD LINKS ====================

export interface RecordLink {
  id: string;
  source_record_id: string;
  target_record_id: string;
  link_type: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  source_record?: {
    id: string;
    unique_name: string;
    definition_name: string;
  };
  target_record?: {
    id: string;
    unique_name: string;
    definition_name: string;
  };
}

interface CreateLinkInput {
  sourceRecordId: string;
  targetRecordId: string;
  linkType: string;
  metadata?: Record<string, unknown>;
}

export function useRecordLinks(recordId: string | null, direction: 'outgoing' | 'incoming' | 'both' = 'both') {
  return useQuery({
    queryKey: ['links', recordId, direction],
    queryFn: () =>
      api.get<{ outgoing: RecordLink[]; incoming: RecordLink[] }>(
        `/links/record/${recordId}?direction=${direction}`
      ),
    enabled: !!recordId,
    staleTime: 30000,
  });
}

export function useCreateLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLinkInput) =>
      api.post<{ link: RecordLink }>('/links', input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['links', variables.sourceRecordId] });
      queryClient.invalidateQueries({ queryKey: ['links', variables.targetRecordId] });
    },
  });
}

export function useDeleteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
    },
  });
}

export function useLinkTypes() {
  return useQuery({
    queryKey: ['link-types'],
    queryFn: () => api.get<{ types: string[] }>('/links/types').then(r => r.types),
    staleTime: 60000,
  });
}
