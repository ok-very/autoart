/**
 * Workflow Service
 *
 * High-level helpers for emitting work-related events.
 * These are convenience functions that wrap the event emission API
 * with domain-specific semantics.
 *
 * All functions emit events - they do NOT mutate any state directly.
 * State is derived by interpreting the event stream.
 */

import type { Event, ContextType } from '../../db/schema.js';
import * as eventsService from './events.service.js';
import * as actionsService from '../actions/actions.service.js';

export interface WorkflowEventInput {
  actionId: string;
  actorId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Emit WORK_STARTED event.
 * Indicates that work has begun on an action.
 */
export async function startWork(input: WorkflowEventInput): Promise<Event> {
  const action = await actionsService.getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  return eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type as ContextType,
    actionId: input.actionId,
    type: 'WORK_STARTED',
    payload: input.payload || {},
    actorId: input.actorId,
  });
}

/**
 * Emit WORK_STOPPED event.
 * Indicates that work has been paused on an action.
 */
export async function stopWork(input: WorkflowEventInput): Promise<Event> {
  const action = await actionsService.getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  return eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type as ContextType,
    actionId: input.actionId,
    type: 'WORK_STOPPED',
    payload: input.payload || {},
    actorId: input.actorId,
  });
}

/**
 * Emit WORK_FINISHED event.
 * Indicates that work has been completed on an action.
 */
export async function finishWork(input: WorkflowEventInput): Promise<Event> {
  const action = await actionsService.getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  return eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type as ContextType,
    actionId: input.actionId,
    type: 'WORK_FINISHED',
    payload: input.payload || {},
    actorId: input.actorId,
  });
}

/**
 * Emit WORK_BLOCKED event.
 * Indicates that an action has become blocked.
 */
export async function blockWork(
  input: WorkflowEventInput & { reason?: string }
): Promise<Event> {
  const action = await actionsService.getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  return eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type as ContextType,
    actionId: input.actionId,
    type: 'WORK_BLOCKED',
    payload: {
      reason: input.reason,
      ...input.payload,
    },
    actorId: input.actorId,
  });
}

/**
 * Emit WORK_UNBLOCKED event.
 * Indicates that a blockage has been resolved.
 */
export async function unblockWork(input: WorkflowEventInput): Promise<Event> {
  const action = await actionsService.getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  return eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type as ContextType,
    actionId: input.actionId,
    type: 'WORK_UNBLOCKED',
    payload: input.payload || {},
    actorId: input.actorId,
  });
}

/**
 * Emit ASSIGNMENT_OCCURRED event.
 * Indicates that someone was assigned to an action.
 */
export async function assignWork(
  input: WorkflowEventInput & { assigneeId: string; assigneeName?: string }
): Promise<Event> {
  const action = await actionsService.getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  return eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type as ContextType,
    actionId: input.actionId,
    type: 'ASSIGNMENT_OCCURRED',
    payload: {
      userId: input.assigneeId,
      userName: input.assigneeName,
      ...input.payload,
    },
    actorId: input.actorId,
  });
}

/**
 * Emit ASSIGNMENT_REMOVED event.
 * Indicates that an assignment was removed from an action.
 */
export async function unassignWork(input: WorkflowEventInput): Promise<Event> {
  const action = await actionsService.getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  return eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type as ContextType,
    actionId: input.actionId,
    type: 'ASSIGNMENT_REMOVED',
    payload: input.payload || {},
    actorId: input.actorId,
  });
}

/**
 * Emit FIELD_VALUE_RECORDED event.
 * Indicates that a field value was captured for an action.
 */
export async function recordFieldValue(
  input: WorkflowEventInput & { fieldKey: string; value: unknown }
): Promise<Event> {
  const action = await actionsService.getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  return eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type as ContextType,
    actionId: input.actionId,
    type: 'FIELD_VALUE_RECORDED',
    payload: {
      fieldKey: input.fieldKey,
      value: input.value,
      ...input.payload,
    },
    actorId: input.actorId,
  });
}
