/**
 * Actions & Events API Hooks
 *
 * Hooks for the foundational model primitives:
 * - Actions (intent declarations)
 * - Events (immutable fact log)
 * - ActionViews (non-reified projections)
 * - Workflow operations (event emission helpers)
 *
 * Core principle: All mutations happen via event emission, not state changes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type {
  Action,
  Event,
  CreateActionInput,
  CreateEventInput,
  ContextType,
} from '@autoart/shared';

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Get all actions (no filters) - for registry "All Actions" view
 */
export function useAllActions(limit = 100) {
  return useQuery({
    queryKey: ['actions', 'all', limit],
    queryFn: () =>
      api
        .get<{ actions: Action[] }>(`/actions?limit=${limit}`)
        .then((r) => r.actions),
  });
}

/**
 * Get all actions for a context (subprocess, stage, etc.)
 */
export function useActions(contextId: string | null, contextType: ContextType) {
  return useQuery({
    queryKey: ['actions', contextId, contextType],
    queryFn: () =>
      api
        .get<{ actions: Action[] }>(`/actions/context/${contextType}/${contextId}`)
        .then((r) => r.actions),
    enabled: !!contextId,
  });
}

/**
 * Get a single action by ID
 */
export function useAction(actionId: string | null) {
  return useQuery({
    queryKey: ['action', actionId],
    queryFn: () =>
      api.get<{ action: Action }>(`/actions/${actionId}`).then((r) => r.action),
    enabled: !!actionId,
  });
}

/**
 * Get all actions of a specific type (across all contexts).
 * Used by registry view to show instances of an action type.
 * @deprecated Use useAllActionsByDefinition for stable lookups by definition_id
 */
export function useAllActionsByType(actionType: string | null, limit = 100) {
  return useQuery({
    queryKey: ['actions', 'byType', actionType],
    queryFn: () =>
      api
        .get<{ actions: Action[] }>(`/actions?type=${encodeURIComponent(actionType!)}&limit=${limit}`)
        .then((r) => r.actions),
    enabled: !!actionType,
  });
}

/**
 * Get all actions for a specific definition (across all contexts).
 * This is the stable lookup pattern for Registry views - uses definition_id instead of type name.
 */
export function useAllActionsByDefinition(definitionId: string | null, limit = 100) {
  return useQuery({
    queryKey: ['actions', 'byDefinition', definitionId],
    queryFn: () =>
      api
        .get<{ actions: Action[] }>(`/actions?definitionId=${definitionId}&limit=${limit}`)
        .then((r) => r.actions),
    enabled: !!definitionId,
  });
}

/**
 * Create a new action (automatically emits ACTION_DECLARED event)
 */
export function useCreateAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateActionInput) =>
      api.post<{ action: Action }>('/actions', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['actions', variables.contextId, variables.contextType],
      });
      queryClient.invalidateQueries({
        queryKey: ['actionViews', variables.contextId],
      });
    },
  });
}

// ============================================================================
// ACTION MUTATIONS (Retract / Amend)
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

/**
 * Retract an action (emits ACTION_RETRACTED event)
 * The action remains in the database but is marked as retracted.
 */
export function useRetractAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, reason }: RetractActionInput) =>
      api.post<RetractActionResult>(`/actions/${actionId}/retract`, { reason }),
    onSuccess: (result) => {
      const actionId = result.action.id;
      queryClient.invalidateQueries({ queryKey: ['action', actionId] });
      queryClient.invalidateQueries({ queryKey: ['events', 'action', actionId] });
      queryClient.invalidateQueries({ queryKey: ['actionView', actionId] });
      queryClient.invalidateQueries({ queryKey: ['actionViews'] });
      queryClient.invalidateQueries({ queryKey: ['actions'] });
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

/**
 * Amend an action's field bindings (emits ACTION_AMENDED event)
 * The original action remains, but interpreters use the latest amendment.
 */
export function useAmendAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, fieldBindings, reason }: AmendActionInput) =>
      api.post<AmendActionResult>(`/actions/${actionId}/amend`, { fieldBindings, reason }),
    onSuccess: (result) => {
      const actionId = result.action.id;
      queryClient.invalidateQueries({ queryKey: ['action', actionId] });
      queryClient.invalidateQueries({ queryKey: ['events', 'action', actionId] });
      queryClient.invalidateQueries({ queryKey: ['actionView', actionId] });
      queryClient.invalidateQueries({ queryKey: ['actionViews'] });
      queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
  });
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Get all events for an action
 */
export function useActionEvents(actionId: string | null) {
  return useQuery({
    queryKey: ['events', 'action', actionId],
    queryFn: () =>
      api.get<{ events: Event[] }>(`/events/action/${actionId}`).then((r) => r.events),
    enabled: !!actionId,
  });
}

/**
 * Get all events for a context
 */
export function useContextEvents(contextId: string | null, contextType: ContextType) {
  return useQuery({
    queryKey: ['events', 'context', contextId, contextType],
    queryFn: () =>
      api
        .get<{ events: Event[] }>(`/events/context/${contextType}/${contextId}`)
        .then((r) => r.events),
    enabled: !!contextId,
  });
}

/**
 * Emit a new event (the ONLY write operation for the event-sourced system)
 */
export function useEmitEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEventInput) =>
      api.post<{ event: Event }>('/events', data),
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['events', 'context', variables.contextId],
      });
      if (variables.actionId) {
        queryClient.invalidateQueries({
          queryKey: ['events', 'action', variables.actionId],
        });
        queryClient.invalidateQueries({
          queryKey: ['actionView', variables.actionId],
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['actionViews', variables.contextId],
      });
    },
  });
}

/**
 * Emit multiple events for an action (batch operation for Composer)
 * This is the preferred way to emit workflow events during action creation.
 */
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
      queryClient.invalidateQueries({
        queryKey: ['events', 'action', variables.actionId],
      });
      queryClient.invalidateQueries({
        queryKey: ['actionView', variables.actionId],
      });
      queryClient.invalidateQueries({
        queryKey: ['actionViews', variables.contextId],
      });
    },
  });
}


// ============================================================================
// WORKFLOW OPERATIONS (Event Emission Helpers)
// ============================================================================

interface WorkflowMutationOptions {
  actionId: string;
  payload?: Record<string, unknown>;
}

/**
 * Start work on an action (emits WORK_STARTED event)
 */
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

/**
 * Stop work on an action (emits WORK_STOPPED event)
 */
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

/**
 * Finish work on an action (emits WORK_FINISHED event)
 */
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

/**
 * Block work on an action (emits WORK_BLOCKED event)
 */
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

/**
 * Unblock work on an action (emits WORK_UNBLOCKED event)
 */
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

/**
 * Assign work to a user (emits ASSIGNMENT_OCCURRED event)
 */
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

/**
 * Unassign work (emits ASSIGNMENT_REMOVED event)
 */
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

/**
 * Record a field value (emits FIELD_VALUE_RECORDED event)
 */
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
  queryClient.invalidateQueries({ queryKey: ['events', 'action', actionId] });
  queryClient.invalidateQueries({ queryKey: ['actionView', actionId] });
  queryClient.invalidateQueries({ queryKey: ['actionViews'] });
}

// ============================================================================
// CONTAINER ACTIONS (Process, Stage, Subprocess)
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

/**
 * Get all container actions (Process, Stage, Subprocess) for a project
 */
export function useContainerActions(projectId: string | null) {
  return useQuery({
    queryKey: ['containerActions', projectId],
    queryFn: () =>
      api
        .get<{ containers: ContainerAction[] }>(`/containers/${projectId}`)
        .then((r) => r.containers),
    enabled: !!projectId,
  });
}

/**
 * Get subprocess container actions for a project
 * This is the hook used by ComposerSurface for context selection
 */
export function useSubprocesses(projectId: string | null) {
  return useQuery({
    queryKey: ['subprocesses', projectId],
    queryFn: () =>
      api
        .get<{ subprocesses: ContainerAction[] }>(`/containers/${projectId}/subprocesses`)
        .then((r) => r.subprocesses),
    enabled: !!projectId,
  });
}

/**
 * Get child actions of a parent container action
 */
export function useChildActions(parentActionId: string | null) {
  return useQuery({
    queryKey: ['childActions', parentActionId],
    queryFn: () =>
      api
        .get<{ children: ContainerAction[] }>(`/containers/children/${parentActionId}`)
        .then((r) => r.children),
    enabled: !!parentActionId,
  });
}

