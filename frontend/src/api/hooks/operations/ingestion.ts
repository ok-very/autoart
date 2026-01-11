import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../client';
import { queryKeys } from '../../queryKeys';

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
    queryKey: queryKeys.ingestion.parsers(),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.projects() });
    },
  });
}

export type { ParserConfigField, ParserSummary, ParsedNode, ParsedData, PreviewResult, IngestionResult };
