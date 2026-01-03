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
