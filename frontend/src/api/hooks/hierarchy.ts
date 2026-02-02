import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useHierarchyStore } from '../../stores/hierarchyStore';
import type { HierarchyNode } from '../../types';
import { api } from '../client';

// ==================== HIERARCHY ====================
// Tree operations don't fit standard CRUD pattern - kept manual

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

export interface AncestorPathEntry {
  id: string;
  title: string;
  type: string;
}

export function useNodePath(nodeId: string | null) {
  return useQuery({
    queryKey: ['hierarchy', 'nodePath', nodeId],
    queryFn: () => api.get<{ path: AncestorPathEntry[] }>(`/hierarchy/nodes/${nodeId}/path`).then(r => r.path),
    enabled: !!nodeId,
    staleTime: 5 * 60 * 1000,
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
  const storeUpdateNode = useHierarchyStore((state) => state.updateNode);
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<HierarchyNode>) =>
      api.patch<{ node: HierarchyNode }>(`/hierarchy/nodes/${id}`, data),
    onSuccess: (result, variables) => {
      const updated = result?.node;

      if (updated) {
        // Update Zustand store immediately for instant UI reactivity
        storeUpdateNode(updated);

        // Keep the inspected node query in sync.
        queryClient.setQueryData(['node', variables.id], updated);

        // Update any cached hierarchy trees in-place so views update immediately
        // (instead of waiting for a refetch to complete).
        queryClient.setQueriesData(
          { queryKey: ['hierarchy'] },
          (oldData: unknown) => {
            if (!Array.isArray(oldData)) return oldData;
            return oldData.map((n) => (n && typeof n === 'object' && (n as { id?: string }).id === updated.id ? updated : n));
          }
        );
      }

      // Note: We intentionally do NOT invalidate queries here to avoid a refetch
      // race condition that could overwrite our direct store/cache updates with
      // stale data. The store and cache are already updated above.
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
