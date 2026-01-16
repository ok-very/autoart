/**
 * Actions & Events API Hooks
 *
 * Hooks for the foundational model primitives:
 * - Actions (intent declarations)
 * - Events (immutable fact log)
 * - Workflow operations (event emission helpers)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  Action,
  Event,
  CreateActionInput,
  CreateEventInput,
  ContextType,
} from '@autoart/shared';

import { api } from '../../client';
import { queryKeys, invalidationHelpers } from '../../queryKeys';

// ============================================================================
// ACTIONS
// ============================================================================

export function useAllActions(options: { limit?: number; offset?: number; refetch?: boolean } = {}) {
  const { limit = 100, offset = 0, refetch = false } = options;
  return useQuery({
    queryKey: queryKeys.actions.list(limit),
    queryFn: () =>
      api
        .get<{ actions: Action[]; total?: number }>(`/actions?limit=${limit}&offset=${offset}`)
        .then((r) => ({ actions: r.actions, total: r.total })),
    // Enable polling every 30 seconds for Registry real-time updates
    refetchInterval: refetch ? 30000 : false,
  });
}

export function useActions(contextId: string | null, contextType: ContextType) {
  return useQuery({
    queryKey: queryKeys.actions.byContext(contextId!, contextType),
    queryFn: () =>
      api
        .get<{ actions: Action[] }>(`/actions/context/${contextType}/${contextId}`)
        .then((r) => r.actions),
    enabled: !!contextId,
  });
}

export function useAction(actionId: string | null) {
  return useQuery({
    queryKey: queryKeys.actions.detail(actionId!),
    queryFn: () =>
      api.get<{ action: Action }>(`/actions/${actionId}`).then((r) => r.action),
    enabled: !!actionId,
  });
}

export function useAllActionsByType(actionType: string | null, limit = 100) {
  return useQuery({
    queryKey: queryKeys.actions.byType(actionType!),
    queryFn: () =>
      api
        .get<{ actions: Action[] }>(`/actions?type=${encodeURIComponent(actionType!)}&limit=${limit}`)
        .then((r) => r.actions),
    enabled: !!actionType,
  });
}

export function useAllActionsByDefinition(definitionId: string | null, limit = 100) {
  return useQuery({
    queryKey: queryKeys.actions.byDefinition(definitionId!),
    queryFn: () =>
      api
        .get<{ actions: Action[] }>(`/actions?definitionId=${definitionId}&limit=${limit}`)
        .then((r) => r.actions),
    enabled: !!definitionId,
  });
}

export function useCreateAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateActionInput) =>
      api.post<{ action: Action }>('/actions', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.actions.byContext(variables.contextId, variables.contextType),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionViews.byContext(variables.contextId, variables.contextType),
      });
    },
  });
}

// ============================================================================
// ACTION MUTATIONS
// ============================================================================

interface RetractActionInput {
  actionId: string;
  reason?: string;
}

interface RetractActionResult {
  success: boolean;
  action: Action;
  eventId: string;
}

export function useRetractAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, reason }: RetractActionInput) =>
      api.post<RetractActionResult>(`/actions/${actionId}/retract`, { reason }),
    onSuccess: (result) => {
      invalidationHelpers.invalidateAction(queryClient, result.action.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.actions.all() });
    },
  });
}

interface AmendActionInput {
  actionId: string;
  fieldBindings: unknown[];
  reason?: string;
}

interface AmendActionResult {
  success: boolean;
  action: Action;
  eventId: string;
}

export function useAmendAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, fieldBindings, reason }: AmendActionInput) =>
      api.post<AmendActionResult>(`/actions/${actionId}/amend`, { fieldBindings, reason }),
    onSuccess: (result) => {
      invalidationHelpers.invalidateAction(queryClient, result.action.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.actions.all() });
    },
  });
}

// ============================================================================
// EVENTS
// ============================================================================

export function useActionEvents(actionId: string | null) {
  return useQuery({
    queryKey: queryKeys.events.byAction(actionId!),
    queryFn: () =>
      api.get<{ events: Event[] }>(`/events/action/${actionId}`).then((r) => r.events),
    enabled: !!actionId,
  });
}

export function useContextEvents(contextId: string | null, contextType: ContextType) {
  return useQuery({
    queryKey: queryKeys.events.byContext(contextId!, contextType),
    queryFn: () =>
      api
        .get<{ events: Event[] }>(`/events/context/${contextType}/${contextId}`)
        .then((r) => r.events),
    enabled: !!contextId,
  });
}

export function useEmitEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEventInput) =>
      api.post<{ event: Event }>('/events', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.byContext(variables.contextId, variables.contextType),
      });
      if (variables.actionId) {
        invalidationHelpers.invalidateAction(queryClient, variables.actionId);
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionViews.byContext(variables.contextId, variables.contextType),
      });
    },
  });
}

export function useEmitActionEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      actionId,
      contextId,
      contextType,
      events,
    }: {
      actionId: string;
      contextId: string;
      contextType: ContextType;
      events: Array<{ type: string; payload?: Record<string, unknown> }>;
    }) => {
      const results: Event[] = [];
      for (const evt of events) {
        const result = await api.post<{ event: Event }>('/events', {
          contextId,
          contextType,
          actionId,
          type: evt.type,
          payload: evt.payload ?? {},
        });
        results.push(result.event);
      }
      return { events: results };
    },
    onSuccess: (_, variables) => {
      invalidationHelpers.invalidateAction(queryClient, variables.actionId);
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionViews.byContext(variables.contextId, variables.contextType),
      });
    },
  });
}

// ============================================================================
// WORKFLOW OPERATIONS
// ============================================================================

interface WorkflowMutationOptions {
  actionId: string;
  payload?: Record<string, unknown>;
}

export function useStartWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, payload }: WorkflowMutationOptions) =>
      api.post<{ event: Event }>(`/workflow/actions/${actionId}/start`, { payload }),
    onSuccess: (_, variables) => {
      invalidateWorkflowQueries(queryClient, variables.actionId);
    },
  });
}

export function useStopWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, payload }: WorkflowMutationOptions) =>
      api.post<{ event: Event }>(`/workflow/actions/${actionId}/stop`, { payload }),
    onSuccess: (_, variables) => {
      invalidateWorkflowQueries(queryClient, variables.actionId);
    },
  });
}

export function useFinishWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, payload }: WorkflowMutationOptions) =>
      api.post<{ event: Event }>(`/workflow/actions/${actionId}/finish`, { payload }),
    onSuccess: (_, variables) => {
      invalidateWorkflowQueries(queryClient, variables.actionId);
    },
  });
}

export function useBlockWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      actionId,
      reason,
      payload,
    }: WorkflowMutationOptions & { reason?: string }) =>
      api.post<{ event: Event }>(`/workflow/actions/${actionId}/block`, {
        reason,
        payload,
      }),
    onSuccess: (_, variables) => {
      invalidateWorkflowQueries(queryClient, variables.actionId);
    },
  });
}

export function useUnblockWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, payload }: WorkflowMutationOptions) =>
      api.post<{ event: Event }>(`/workflow/actions/${actionId}/unblock`, { payload }),
    onSuccess: (_, variables) => {
      invalidateWorkflowQueries(queryClient, variables.actionId);
    },
  });
}

export function useAssignWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      actionId,
      assigneeId,
      assigneeName,
      payload,
    }: WorkflowMutationOptions & { assigneeId: string; assigneeName?: string }) =>
      api.post<{ event: Event }>(`/workflow/actions/${actionId}/assign`, {
        assigneeId,
        assigneeName,
        payload,
      }),
    onSuccess: (_, variables) => {
      invalidateWorkflowQueries(queryClient, variables.actionId);
    },
  });
}

export function useUnassignWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, payload }: WorkflowMutationOptions) =>
      api.post<{ event: Event }>(`/workflow/actions/${actionId}/unassign`, { payload }),
    onSuccess: (_, variables) => {
      invalidateWorkflowQueries(queryClient, variables.actionId);
    },
  });
}

export function useRecordFieldValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      actionId,
      fieldKey,
      value,
      payload,
    }: WorkflowMutationOptions & { fieldKey: string; value: unknown }) =>
      api.post<{ event: Event }>(`/workflow/actions/${actionId}/field`, {
        fieldKey,
        value,
        payload,
      }),
    onSuccess: (_, variables) => {
      invalidateWorkflowQueries(queryClient, variables.actionId);
    },
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function invalidateWorkflowQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  actionId: string
) {
  invalidationHelpers.invalidateAction(queryClient, actionId);
}

// ============================================================================
// CONTAINER ACTIONS
// ============================================================================

interface ContainerAction {
  id: string;
  contextId: string;
  contextType: ContextType;
  parentActionId: string | null;
  type: string;
  fieldBindings: unknown[];
  createdAt: Date;
}

export function useContainerActions(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.actions.containerActions(projectId!),
    queryFn: () =>
      api
        .get<{ containers: ContainerAction[] }>(`/containers/${projectId}`)
        .then((r) => r.containers),
    enabled: !!projectId,
  });
}

export function useSubprocesses(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.actions.subprocesses(projectId!),
    queryFn: () =>
      api
        .get<{ subprocesses: ContainerAction[] }>(`/containers/${projectId}/subprocesses`)
        .then((r) => r.subprocesses),
    enabled: !!projectId,
  });
}

export function useChildActions(parentActionId: string | null) {
  return useQuery({
    queryKey: queryKeys.actions.childActions(parentActionId!),
    queryFn: () =>
      api
        .get<{ children: ContainerAction[] }>(`/containers/children/${parentActionId}`)
        .then((r) => r.children),
    enabled: !!parentActionId,
  });
}
