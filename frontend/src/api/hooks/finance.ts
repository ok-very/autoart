import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { DataRecord, CreateRecordInput, UpdateRecordInput } from '../../types';
import { api } from '../client';

// ============================================================================
// FINANCE RECORDS (generic by definition name)
// ============================================================================

interface FinanceRecordFilters {
  definitionId?: string;
  status?: string;
  search?: string;
  resolve?: boolean;
}

/**
 * List records for a given definition with optional filters.
 * Use resolve=true to include computed field values.
 */
export function useFinanceRecords(filters?: FinanceRecordFilters) {
  return useQuery({
    queryKey: ['finance-records', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.definitionId) params.set('definitionId', filters.definitionId);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.resolve) params.set('resolve', 'true');
      return api.get<{ records: DataRecord[] }>(`/records?${params}`).then(r => r.records);
    },
    enabled: !!filters?.definitionId,
  });
}

/**
 * Single finance record with computed fields resolved.
 */
export function useFinanceRecord(id: string | null) {
  return useQuery({
    queryKey: ['finance-record', id],
    queryFn: () =>
      api.get<{ record: DataRecord; _computed?: Record<string, unknown> }>(
        `/records/${id}?resolve=true`,
      ),
    enabled: !!id,
  });
}

/**
 * Linked records for a parent record by link type.
 * E.g., line items for an invoice, payments for an invoice.
 */
export function useLinkedRecords(recordId: string | null, linkType?: string) {
  return useQuery({
    queryKey: ['linked-records', recordId, linkType],
    queryFn: async () => {
      const linksRes = await api.get<{
        outgoing: Array<{
          id: string;
          target_record_id: string;
          link_type: string;
          target_record?: { id: string; unique_name: string; definition_name: string };
        }>;
      }>(`/links/record/${recordId}?direction=outgoing`);

      const filtered = linkType
        ? linksRes.outgoing.filter((l) => l.link_type === linkType)
        : linksRes.outgoing;

      if (filtered.length === 0) return [];

      // Fetch full records for the linked targets
      const targetIds = filtered.map((l) => l.target_record_id);
      const records: DataRecord[] = [];
      for (const id of targetIds) {
        const res = await api.get<{ record: DataRecord; _computed?: Record<string, unknown> }>(
          `/records/${id}?resolve=true`,
        );
        // Merge computed values into data for display
        if (res._computed) {
          records.push({
            ...res.record,
            data: { ...(res.record.data as Record<string, unknown>), ...res._computed },
          });
        } else {
          records.push(res.record);
        }
      }

      return records;
    },
    enabled: !!recordId,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useCreateFinanceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecordInput) =>
      api.post<{ record: DataRecord }>('/records', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-records'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['record-stats'] });
    },
  });
}

export function useUpdateFinanceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateRecordInput) =>
      api.patch<{ record: DataRecord }>(`/records/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-records'] });
      queryClient.invalidateQueries({ queryKey: ['finance-record'] });
      queryClient.invalidateQueries({ queryKey: ['linked-records'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });
}

/**
 * Create a record link (e.g., Invoice → Line Item, Invoice → Payment).
 */
export function useCreateFinanceLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { sourceRecordId: string; targetRecordId: string; linkType: string }) =>
      api.post<{ link: unknown }>('/links', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linked-records'] });
      queryClient.invalidateQueries({ queryKey: ['links'] });
      queryClient.invalidateQueries({ queryKey: ['finance-record'] });
    },
  });
}
