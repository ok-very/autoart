/**
 * Workflow Surface API Hooks
 *
 * Hooks for fetching workflow surface nodes (materialized projections)
 * and managing dependencies.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  WorkflowSurfaceNode,
  WorkflowSurfaceResponse,
  ContextType,
  DependencyInput,
  MoveWorkflowRowInput,
} from '@autoart/shared';

import { api } from '../../client';
import { queryKeys } from '../../queryKeys';

// ============================================================================
// QUERIES
// ============================================================================

export function useWorkflowSurfaceNodes(
  contextId: string | null,
  contextType: ContextType
) {
  return useQuery({
    queryKey: queryKeys.workflowSurface.nodes(contextId!),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('contextId', contextId!);
      params.set('contextType', contextType);

      const response = await api.get<WorkflowSurfaceResponse>(
        `/workflow/surfaces/workflow_table?${params}`
      );

      return response.nodes;
    },
    enabled: !!contextId && !!contextType,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useAddDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      actionId,
      dependsOnActionId,
    }: {
      actionId: string;
      dependsOnActionId: string;
    }) => {
      const response = await api.post<{ event: unknown }>(
        `/workflow/actions/${actionId}/dependencies/add`,
        { dependsOnActionId } as DependencyInput
      );
      return response.event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowSurface.all() });
    },
  });
}

export function useRemoveDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      actionId,
      dependsOnActionId,
    }: {
      actionId: string;
      dependsOnActionId: string;
    }) => {
      const response = await api.post<{ event: unknown }>(
        `/workflow/actions/${actionId}/dependencies/remove`,
        { dependsOnActionId } as DependencyInput
      );
      return response.event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowSurface.all() });
    },
  });
}

export function useMoveWorkflowRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      actionId,
      surfaceType = 'workflow_table',
      afterActionId,
    }: {
      actionId: string;
      surfaceType?: string;
      afterActionId: string | null;
    }) => {
      const response = await api.post<{ event: unknown }>(
        `/workflow/actions/${actionId}/move`,
        { surfaceType, afterActionId } as MoveWorkflowRowInput
      );
      return response.event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowSurface.all() });
    },
  });
}

export function useRefreshWorkflowSurface() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contextId,
      contextType,
    }: {
      contextId: string;
      contextType: ContextType;
    }) => {
      const params = new URLSearchParams();
      params.set('contextId', contextId);
      params.set('contextType', contextType);

      const response = await api.post<{ success: boolean; message: string }>(
        `/workflow/surfaces/workflow_table/refresh?${params}`,
        {}
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowSurface.all() });
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function buildChildrenMap(
  nodes: WorkflowSurfaceNode[]
): Map<string | null, WorkflowSurfaceNode[]> {
  const map = new Map<string | null, WorkflowSurfaceNode[]>();

  for (const node of nodes) {
    const siblings = map.get(node.parentActionId) || [];
    siblings.push(node);
    map.set(node.parentActionId, siblings);
  }

  for (const [, siblings] of map) {
    siblings.sort((a, b) => a.position - b.position);
  }

  return map;
}

export function getRootNodes(
  nodes: WorkflowSurfaceNode[]
): WorkflowSurfaceNode[] {
  return nodes
    .filter((n) => n.parentActionId === null)
    .sort((a, b) => a.position - b.position);
}

export function getChildren(
  childrenMap: Map<string | null, WorkflowSurfaceNode[]>,
  actionId: string | null
): WorkflowSurfaceNode[] {
  return childrenMap.get(actionId) || [];
}
