import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { DataRecord, CreateRecordInput, UpdateRecordInput } from '../../types';

// ==================== RECORDS DATA ====================

interface RecordFilters {
  definitionId?: string;
  classificationNodeId?: string;
  search?: string;
}

export function useRecords(filters?: RecordFilters) {
  return useQuery({
    queryKey: ['records', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.definitionId) params.set('definitionId', filters.definitionId);
      if (filters?.classificationNodeId) params.set('classificationNodeId', filters.classificationNodeId);
      if (filters?.search) params.set('search', filters.search);
      return api.get<{ records: DataRecord[] }>(`/records?${params}`).then(r => r.records);
    },
  });
}

export function useRecord(id: string | null) {
  return useQuery({
    queryKey: ['record', id],
    queryFn: () => api.get<{ record: DataRecord }>(`/records/${id}`).then(r => r.record),
    enabled: !!id,
  });
}

export function useCreateRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecordInput) =>
      api.post<{ record: DataRecord }>('/records', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });
}

export function useUpdateRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateRecordInput) =>
      api.patch<{ record: DataRecord }>(`/records/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['record'] });
    },
  });
}

export function useDeleteRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['record'] });
      queryClient.invalidateQueries({ queryKey: ['links'] });
    },
  });
}

// ==================== RECORD STATS ====================

interface RecordStat {
  definitionId: string;
  definitionName: string;
  count: number;
}

export function useRecordStats() {
  return useQuery({
    queryKey: ['record-stats'],
    queryFn: () => api.get<{ stats: RecordStat[] }>('/records/stats').then(r => r.stats),
    staleTime: 30000,
  });
}

// ==================== BULK OPERATIONS ====================

export function useBulkClassifyRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { recordIds: string[]; classificationNodeId: string | null }) =>
      api.post<{ updated: number }>('/records/bulk/classify', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['record-stats'] });
    },
  });
}

export function useBulkDeleteRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordIds: string[]) =>
      api.post<{ deleted: number }>('/records/bulk/delete', { recordIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['record-stats'] });
      queryClient.invalidateQueries({ queryKey: ['links'] });
    },
  });
}
