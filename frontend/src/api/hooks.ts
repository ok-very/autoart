import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  HierarchyNode,
  RecordDefinition,
  DataRecord,
  TaskReference,
  ResolvedReference,
  SearchResult,
  AuthResponse,
  User
} from '../types';

// ==================== AUTH ====================

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<AuthResponse>('/auth/login', data, { skipAuth: true }),
    onSuccess: (data) => {
      api.setToken(data.accessToken);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string }) =>
      api.post<AuthResponse>('/auth/register', data, { skipAuth: true }),
    onSuccess: (data) => {
      api.setToken(data.accessToken);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      api.setToken(null);
      queryClient.clear();
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => api.get<{ user: User }>('/auth/me').then(r => r.user),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

// ==================== HIERARCHY ====================

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ projects: HierarchyNode[] }>('/hierarchy/projects').then(r => r.projects),
  });
}

export function useProjectTree(projectId: string | null) {
  return useQuery({
    queryKey: ['hierarchy', projectId],
    queryFn: () => api.get<{ nodes: HierarchyNode[] }>(`/hierarchy/${projectId}`).then(r => r.nodes),
    enabled: !!projectId,
  });
}

export function useNode(nodeId: string | null) {
  return useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => api.get<{ node: HierarchyNode }>(`/hierarchy/nodes/${nodeId}`).then(r => r.node),
    enabled: !!nodeId,
  });
}

interface CreateNodeInput {
  parentId?: string | null;
  type: HierarchyNode['type'];
  title: string;
  description?: unknown;
  metadata?: Record<string, unknown>;
  position?: number;
}

export function useCreateNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNodeInput) =>
      api.post<{ node: HierarchyNode }>('/hierarchy/nodes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<HierarchyNode>) =>
      api.patch<{ node: HierarchyNode }>(`/hierarchy/nodes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['node'] });
    },
  });
}

export function useDeleteNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hierarchy/nodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useMoveNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newParentId, position }: { id: string; newParentId: string | null; position: number }) =>
      api.patch<{ node: HierarchyNode }>(`/hierarchy/nodes/${id}/move`, { newParentId, position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useCloneNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sourceNodeId: string;
      targetParentId?: string | null;
      overrides?: { title?: string; metadata?: Record<string, unknown> };
      depth?: 'all' | 'process' | 'stage' | 'subprocess';
      includeTemplates?: boolean;
      includeRecords?: boolean;
    }) =>
      api.post<{ node: HierarchyNode }>('/hierarchy/clone', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['definitions'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });
}

// ==================== RECORDS ====================

export function useRecordDefinitions() {
  return useQuery({
    queryKey: ['definitions'],
    queryFn: () => api.get<{ definitions: RecordDefinition[] }>('/records/definitions').then(r => r.definitions),
  });
}

export function useRecordDefinition(id: string | null) {
  return useQuery({
    queryKey: ['definition', id],
    queryFn: () => api.get<{ definition: RecordDefinition }>(`/records/definitions/${id}`).then(r => r.definition),
    enabled: !!id,
  });
}

interface CreateDefinitionInput {
  name: string;
  schemaConfig: { fields: RecordDefinition['schema_config']['fields'] };
  styling?: RecordDefinition['styling'];
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

interface UpdateDefinitionInput {
  id: string;
  name?: string;
  schemaConfig?: { fields: RecordDefinition['schema_config']['fields'] };
  styling?: RecordDefinition['styling'];
}

export function useUpdateDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateDefinitionInput) =>
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

// ==================== RECORDS DATA ====================

export function useRecords(filters?: { definitionId?: string; classificationNodeId?: string; search?: string }) {
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
    mutationFn: (data: Partial<DataRecord>) =>
      api.post<{ record: DataRecord }>('/records', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });
}

export function useUpdateRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<DataRecord>) =>
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

// ==================== REFERENCES ====================

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

// ==================== SEARCH ====================

export function useSearch(query: string, projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['search', query, projectId],
    queryFn: () => {
      const params = new URLSearchParams({ q: query || '' });
      if (projectId) params.set('projectId', projectId);
      return api.get<{ results: SearchResult[] }>(`/search/resolve?${params}`).then(r => r.results);
    },
    enabled,
    staleTime: 10000,
  });
}

// ==================== INGESTION ====================

interface ParserConfigField {
  key: string;
  label: string;
  type: 'text' | 'regex' | 'number' | 'boolean';
  defaultValue: string | number | boolean;
  description?: string;
}

interface ParserSummary {
  name: string;
  version: string;
  description: string;
  configFields: ParserConfigField[];
}

interface ParsedNode {
  tempId: string;
  parentTempId: string | null;
  type: string;
  title: string;
  metadata?: Record<string, unknown>;
}

interface ParsedData {
  projectTitle: string;
  projectMeta: Record<string, unknown>;
  nodes: ParsedNode[];
}

interface PreviewResult {
  parsedData: ParsedData;
  stageCount: number;
  taskCount: number;
}

interface IngestionResult {
  projectId: string;
  projectTitle: string;
  nodeCount: number;
  parsedData: ParsedData;
}

export function useIngestionParsers() {
  return useQuery({
    queryKey: ['ingestion-parsers'],
    queryFn: () => api.get<{ parsers: ParserSummary[] }>('/ingestion/parsers').then(r => r.parsers),
    staleTime: 60000,
  });
}

export function useIngestionPreview() {
  return useMutation({
    mutationFn: (data: { parserName: string; rawData: string; config?: Record<string, unknown> }) =>
      api.post<PreviewResult>('/ingestion/preview', data),
  });
}

export function useRunIngestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { parserName: string; rawData: string; config?: Record<string, unknown>; targetProjectId?: string | null }) =>
      api.post<IngestionResult>('/ingestion/import', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// ==================== RECORD LINKS ====================

interface RecordLink {
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
