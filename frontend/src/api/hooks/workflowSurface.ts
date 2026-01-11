/**
 * Workflow Surface API Hooks
 *
 * Hooks for fetching workflow surface nodes (materialized projections)
 * and managing dependencies.
 *
 * The workflow surface is a tree structure where:
 * - Parent = blocked action (the action that depends on others)
 * - Children = prerequisites (the actions that must complete first)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type {
  WorkflowSurfaceNode,
  WorkflowSurfaceResponse,
  ContextType,
  DependencyInput,
  MoveWorkflowRowInput,
} from '@autoart/shared';

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Fetch workflow surface nodes for a context.
 * Returns a flat list of nodes with parent-child relationships.
 */
export function useWorkflowSurfaceNodes(
  contextId: string | null,
  contextType: ContextType
) {
  return useQuery({
    queryKey: ['workflowSurface', contextType, contextId],
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

/**
 * Add a dependency between two actions.
 * actionId depends on dependsOnActionId (prerequisite).
 */
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
      // Invalidate workflow surface queries to refetch updated tree
      queryClient.invalidateQueries({ queryKey: ['workflowSurface'] });
    },
  });
}

/**
 * Remove a dependency between two actions.
 */
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
      queryClient.invalidateQueries({ queryKey: ['workflowSurface'] });
    },
  });
}

/**
 * Move a workflow row to a new position.
 */
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
      queryClient.invalidateQueries({ queryKey: ['workflowSurface'] });
    },
  });
}

/**
 * Force refresh the workflow surface (debug/admin use).
 */
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
      queryClient.invalidateQueries({ queryKey: ['workflowSurface'] });
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build a children map from flat surface nodes for O(1) child lookup.
 * Returns Map<parentActionId | null, children[]>
 */
export function buildChildrenMap(
  nodes: WorkflowSurfaceNode[]
): Map<string | null, WorkflowSurfaceNode[]> {
  const map = new Map<string | null, WorkflowSurfaceNode[]>();

  for (const node of nodes) {
    const siblings = map.get(node.parentActionId) || [];
    siblings.push(node);
    map.set(node.parentActionId, siblings);
  }

  // Sort each group by position
  for (const [, siblings] of map) {
    siblings.sort((a, b) => a.position - b.position);
  }

  return map;
}

/**
 * Get root nodes (nodes with no parent).
 */
export function getRootNodes(
  nodes: WorkflowSurfaceNode[]
): WorkflowSurfaceNode[] {
  return nodes
    .filter((n) => n.parentActionId === null)
    .sort((a, b) => a.position - b.position);
}

/**
 * Get children of a specific action.
 */
export function getChildren(
  childrenMap: Map<string | null, WorkflowSurfaceNode[]>,
  actionId: string | null
): WorkflowSurfaceNode[] {
  return childrenMap.get(actionId) || [];
}
