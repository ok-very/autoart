import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../client';
import { queryKeys } from '../queryKeys';
import type { HierarchyNode } from '../../../types';
import { useHierarchyStore } from '../../../stores/hierarchyStore';

// ==================== HIERARCHY ====================
// Tree operations don't fit standard CRUD pattern - kept manual

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.hierarchy.projects(),
    queryFn: () => api.get<{ projects: HierarchyNode[] }>('/hierarchy/projects').then(r => r.projects),
  });
}

export function useProjectTree(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.hierarchy.projectTree(projectId!),
    queryFn: () => api.get<{ nodes: HierarchyNode[] }>(`/hierarchy/${projectId}`).then(r => r.nodes),
    enabled: !!projectId,
  });
}

export function useNode(nodeId: string | null) {
  return useQuery({
    queryKey: queryKeys.hierarchy.node(nodeId!),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.projects() });
    },
  });
}

export function useUpdateNode() {
  const queryClient = useQueryClient();
  const storeUpdateNode = useHierarchyStore((state) => state.updateNode);
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<HierarchyNode>) =>
      api.patch<{ node: HierarchyNode }>(`/hierarchy/nodes/${id}`, data),
    onSuccess: (result, variables) => {
      const updated = result?.node;

      if (updated) {
        storeUpdateNode(updated);
        queryClient.setQueryData(queryKeys.hierarchy.node(variables.id), updated);
        queryClient.setQueriesData(
          { queryKey: queryKeys.hierarchy.all() },
          (oldData: unknown) => {
            if (!Array.isArray(oldData)) return oldData;
            return oldData.map((n) => (n && typeof n === 'object' && (n as { id?: string }).id === updated.id ? updated : n));
          }
        );
      }
    },
  });
}

export function useDeleteNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hierarchy/nodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.projects() });
    },
  });
}

export function useMoveNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newParentId, position }: { id: string; newParentId: string | null; position: number }) =>
      api.patch<{ node: HierarchyNode }>(`/hierarchy/nodes/${id}/move`, { newParentId, position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.projects() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.projects() });
      queryClient.invalidateQueries({ queryKey: queryKeys.definitions.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.records.all() });
    },
  });
}
