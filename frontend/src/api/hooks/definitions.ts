import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { RecordDefinition, CreateDefinitionInput, UpdateDefinitionInput } from '../../types';
import { api } from '../client';

// ==================== RECORD DEFINITIONS ====================
// Base CRUD operations

export function useRecordDefinitions() {
  return useQuery({
    queryKey: ['definitions'],
    queryFn: () => api.get<{ definitions: RecordDefinition[] }>('/records/definitions').then(r => r.definitions),
  });
}

export interface DefinitionFilterOptions {
  definitionKind?: 'record' | 'action_arrangement' | 'container';
  projectId?: string;
  isTemplate?: boolean;
  isSystem?: boolean;
}

export function useRecordDefinitionsFiltered(options: DefinitionFilterOptions) {
  const params = new URLSearchParams();
  if (options.definitionKind) params.set('definitionKind', options.definitionKind);
  if (options.projectId) params.set('projectId', options.projectId);
  if (options.isTemplate !== undefined) params.set('isTemplate', String(options.isTemplate));
  if (options.isSystem !== undefined) params.set('isSystem', String(options.isSystem));

  const queryString = params.toString();
  const url = queryString ? `/records/definitions?${queryString}` : '/records/definitions';

  return useQuery({
    queryKey: ['definitions', 'filtered', options],
    queryFn: () => api.get<{ definitions: RecordDefinition[] }>(url).then(r => r.definitions),
  });
}

export function useRecordDefinition(id: string | null) {
  return useQuery({
    queryKey: ['definition', id],
    queryFn: () => api.get<{ definition: RecordDefinition }>(`/records/definitions/${id}`).then(r => r.definition),
    enabled: !!id,
  });
}

export function useCreateDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDefinitionInput) =>
      api.post<{ definition: RecordDefinition }>('/records/definitions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['definitions'] });
    },
  });
}

export function useUpdateDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateDefinitionInput) =>
      api.patch<{ definition: RecordDefinition }>(`/records/definitions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['definitions'] });
      queryClient.invalidateQueries({ queryKey: ['definition'] });
    },
  });
}

export function useDeleteDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/records/definitions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['definitions'] });
    },
  });
}

// ==================== TEMPLATE LIBRARY ====================
// Procedural operations for library management

export function useProjectTemplates(projectId: string | null) {
  return useQuery({
    queryKey: ['projectTemplates', projectId],
    queryFn: () =>
      api.get<{ definitions: RecordDefinition[] }>(`/records/definitions/library/${projectId}`).then(r => r.definitions),
    enabled: !!projectId,
  });
}

export function useSaveToLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ definitionId, projectId }: { definitionId: string; projectId: string }) =>
      api.post<{ definition: RecordDefinition }>(`/records/definitions/${definitionId}/save-to-library`, { projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['definitions'] });
      queryClient.invalidateQueries({ queryKey: ['definition'] });
      queryClient.invalidateQueries({ queryKey: ['projectTemplates'] });
    },
  });
}

export function useRemoveFromLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (definitionId: string) =>
      api.post<{ definition: RecordDefinition }>(`/records/definitions/${definitionId}/remove-from-library`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['definitions'] });
      queryClient.invalidateQueries({ queryKey: ['definition'] });
      queryClient.invalidateQueries({ queryKey: ['projectTemplates'] });
    },
  });
}

export function useToggleCloneExcluded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ definitionId, excluded }: { definitionId: string; excluded: boolean }) =>
      api.post<{ definition: RecordDefinition }>(`/records/definitions/${definitionId}/toggle-clone-excluded`, { excluded }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['definitions'] });
      queryClient.invalidateQueries({ queryKey: ['definition'] });
      queryClient.invalidateQueries({ queryKey: ['cloneStats'] });
    },
  });
}

export function useCloneStats(projectId: string | null) {
  return useQuery({
    queryKey: ['cloneStats', projectId],
    queryFn: () =>
      api.get<{ stats: { total: number; excluded: number } }>(`/records/definitions/clone-stats/${projectId}`).then(r => r.stats),
    enabled: !!projectId,
  });
}
