/**
 * Actions Service
 *
 * Manages Actions - intent declarations that describe what should or could happen.
 * Actions are the first of two foundational primitives (Actions + Events).
 *
 * Key principles:
 * - Actions are immutable once created (no update operations)
 * - Actions contain NO status, progress, completed_at, or assignee
 * - Outcomes are derived by interpreting Events against Actions
 * - Creating an action automatically emits ACTION_DECLARED event
 */

import { db } from '../../db/client.js';
import type { NewAction, Action, ContextType } from '../../db/schema.js';
import * as eventsService from '../events/events.service.js';

export interface CreateActionInput {
  contextId: string;
  contextType: ContextType;
  type: string;
  fieldBindings?: unknown[];
  actorId?: string;
}

/**
 * Create a new action (intent declaration).
 * Actions are immutable - once created, they cannot be modified.
 * Automatically emits an ACTION_DECLARED event.
 */
export async function createAction(input: CreateActionInput): Promise<Action> {
  // Guard: Stage context is deprecated
  if (input.contextType === 'stage') {
    throw new Error('Stage context is deprecated; use subprocess context with stage metadata');
  }

  const newAction: NewAction = {
    context_id: input.contextId,
    context_type: input.contextType,
    type: input.type,
    field_bindings: input.fieldBindings || [],
  };

  const action = await db
    .insertInto('actions')
    .values(newAction)
    .returningAll()
    .executeTakeFirstOrThrow();

  // Auto-emit ACTION_DECLARED event
  await eventsService.emitEvent({
    contextId: input.contextId,
    contextType: input.contextType,
    actionId: action.id,
    type: 'ACTION_DECLARED',
    payload: {
      actionType: input.type,
      fieldBindings: input.fieldBindings || [],
    },
    actorId: input.actorId,
  });

  return action;
}

/**
 * Get an action by ID.
 */
export async function getActionById(id: string): Promise<Action | undefined> {
  return db
    .selectFrom('actions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

/**
 * Get all actions for a specific context.
 * This is the primary query pattern - actions scoped to a subprocess/stage/etc.
 */
export async function getActionsByContext(
  contextId: string,
  contextType: ContextType
): Promise<Action[]> {
  return db
    .selectFrom('actions')
    .selectAll()
    .where('context_id', '=', contextId)
    .where('context_type', '=', contextType)
    .orderBy('created_at', 'asc')
    .execute();
}

/**
 * Get actions by type within a context.
 */
export async function getActionsByType(
  contextId: string,
  contextType: ContextType,
  actionType: string
): Promise<Action[]> {
  return db
    .selectFrom('actions')
    .selectAll()
    .where('context_id', '=', contextId)
    .where('context_type', '=', contextType)
    .where('type', '=', actionType)
    .orderBy('created_at', 'asc')
    .execute();
}

/**
 * Get all actions (admin/debugging only).
 * In production, this should be paginated or restricted.
 */
export async function getAllActions(limit = 100): Promise<Action[]> {
  return db
    .selectFrom('actions')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();
}

/**
 * Get all actions for a specific definition.
 * This is the stable lookup pattern for Registry views.
 */
export async function getActionsByDefinition(
  definitionId: string,
  limit = 100
): Promise<Action[]> {
  return db
    .selectFrom('actions')
    .selectAll()
    .where('definition_id', '=', definitionId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();
}

/**
 * Count actions for a context.
 */
export async function countActionsByContext(
  contextId: string,
  contextType: ContextType
): Promise<number> {
  const result = await db
    .selectFrom('actions')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('context_id', '=', contextId)
    .where('context_type', '=', contextType)
    .executeTakeFirst();

  return parseInt(result?.count || '0', 10);
}

// Container types for hierarchical action structure
const CONTAINER_TYPES = ['Process', 'Stage', 'Subprocess'];

/**
 * Get container actions for a project.
 * Container actions are Process, Stage, and Subprocess type actions
 * that form the hierarchy for task-like actions.
 */
export async function getContainerActions(
  projectId: string
): Promise<Action[]> {
  return db
    .selectFrom('actions')
    .selectAll()
    .where('context_id', '=', projectId)
    .where('context_type', '=', 'project')
    .where('type', 'in', CONTAINER_TYPES)
    .orderBy('created_at', 'asc')
    .execute();
}

/**
 * Get container actions of a specific type.
 */
export async function getContainerActionsByType(
  projectId: string,
  containerType: string
): Promise<Action[]> {
  return db
    .selectFrom('actions')
    .selectAll()
    .where('context_id', '=', projectId)
    .where('context_type', '=', 'project')
    .where('type', '=', containerType)
    .orderBy('created_at', 'asc')
    .execute();
}

/**
 * Get child actions of a parent action (for tree traversal).
 */
export async function getChildActions(
  parentActionId: string
): Promise<Action[]> {
  return db
    .selectFrom('actions')
    .selectAll()
    .where('parent_action_id', '=', parentActionId)
    .orderBy('created_at', 'asc')
    .execute();
}

// ==================== ACTION MUTATIONS ====================
// Actions are immutable, but we can emit events to mark them as retracted or amended.
// The interpreter will process these events to determine the action's effective status.

export interface RetractActionInput {
  actionId: string;
  reason?: string;
  actorId?: string;
}

/**
 * Retract an action.
 * This emits an ACTION_RETRACTED event - the action itself remains in the database.
 * The interpreter uses this to filter out retracted actions from views.
 */
export async function retractAction(input: RetractActionInput): Promise<{ action: Action; eventId: string }> {
  const action = await getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  // Emit ACTION_RETRACTED event
  const event = await eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type,
    actionId: action.id,
    type: 'ACTION_RETRACTED',
    payload: {
      reason: input.reason || 'Retracted by user',
      retractedAt: new Date().toISOString(),
    },
    actorId: input.actorId,
  });

  return { action, eventId: event.id };
}

export interface AmendActionInput {
  actionId: string;
  fieldBindings: unknown[];
  reason?: string;
  actorId?: string;
}

/**
 * Amend an action's field bindings.
 * This emits an ACTION_AMENDED event with the new bindings.
 * The interpreter uses the latest amendment to determine effective field values.
 */
export async function amendAction(input: AmendActionInput): Promise<{ action: Action; eventId: string }> {
  const action = await getActionById(input.actionId);
  if (!action) {
    throw new Error(`Action not found: ${input.actionId}`);
  }

  // Emit ACTION_AMENDED event
  const event = await eventsService.emitEvent({
    contextId: action.context_id,
    contextType: action.context_type,
    actionId: action.id,
    type: 'ACTION_AMENDED',
    payload: {
      previousBindings: action.field_bindings,
      newBindings: input.fieldBindings,
      reason: input.reason || 'Amended by user',
      amendedAt: new Date().toISOString(),
    },
    actorId: input.actorId,
  });

  return { action, eventId: event.id };
}
