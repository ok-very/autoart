/**
 * Interpreter Service
 *
 * The core interpretation layer that derives ActionViews from Actions and Events.
 * This is the heart of the foundational model - all state is computed, never stored.
 *
 * Key principles:
 * - Pure functions - deterministic, idempotent, side-effect free
 * - ActionViews are non-reified (no ID, no persistence, disposable)
 * - State derivation rules are explicit and testable
 *
 * State derivation rules:
 * - No events                    → status: 'pending'
 * - WORK_STARTED (most recent)   → status: 'active'
 * - WORK_BLOCKED (most recent)   → status: 'blocked'
 * - WORK_FINISHED (any)          → status: 'finished'
 */

import type { Action, Event } from '../../db/schema.js';
import * as actionsService from '../actions/actions.service.js';
import * as eventsService from '../events/events.service.js';
import type { ContextType } from '../../db/schema.js';

// ============================================================================
// TYPES
// ============================================================================

export type DerivedStatus = 'pending' | 'active' | 'blocked' | 'finished';
export type ActionViewType = 'task-like' | 'kanban-card' | 'timeline-row';

export interface TaskLikeViewPayload {
  title: string;
  description?: unknown;
  status: DerivedStatus;
  assignee?: { id: string; name: string };
  dueDate?: string;
  percentComplete?: number;
}

export interface ActionView {
  actionId: string;
  viewType: ActionViewType;
  renderedAt: Date;
  data: TaskLikeViewPayload;
}

// ============================================================================
// PURE INTERPRETATION FUNCTIONS
// ============================================================================

/**
 * Derive status from events.
 * This is a pure function - given the same events, it always returns the same status.
 *
 * Rules:
 * 1. If any WORK_FINISHED event exists → 'finished'
 * 2. Otherwise, look at most recent work event:
 *    - WORK_STARTED → 'active'
 *    - WORK_BLOCKED → 'blocked'
 *    - WORK_STOPPED → 'pending' (back to pending after stop)
 *    - WORK_UNBLOCKED → 'active' (unblocked means can continue)
 * 3. If no work events → 'pending'
 */
export function deriveStatus(events: Event[]): DerivedStatus {
  // Rule 1: Check for finished
  const hasFinished = events.some((e) => e.type === 'WORK_FINISHED');
  if (hasFinished) {
    return 'finished';
  }

  // Rule 2: Find most recent work event
  const workEventTypes = [
    'WORK_STARTED',
    'WORK_STOPPED',
    'WORK_BLOCKED',
    'WORK_UNBLOCKED',
  ];

  const workEvents = events
    .filter((e) => workEventTypes.includes(e.type))
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  if (workEvents.length === 0) {
    return 'pending';
  }

  const mostRecent = workEvents[0];

  switch (mostRecent.type) {
    case 'WORK_STARTED':
    case 'WORK_UNBLOCKED':
      return 'active';
    case 'WORK_BLOCKED':
      return 'blocked';
    case 'WORK_STOPPED':
      return 'pending';
    default:
      return 'pending';
  }
}

/**
 * Extract title from action field bindings.
 */
export function extractTitle(action: Action): string {
  const bindings = action.field_bindings as Array<{ fieldKey: string; value?: unknown }> | null;

  if (!bindings || !Array.isArray(bindings)) {
    return `Action ${action.id.slice(0, 8)}`;
  }

  const titleBinding = bindings.find((b) => b.fieldKey === 'title');
  if (titleBinding?.value && typeof titleBinding.value === 'string') {
    return titleBinding.value;
  }

  return `Action ${action.id.slice(0, 8)}`;
}

/**
 * Extract description from action field bindings.
 */
export function extractDescription(action: Action): unknown | undefined {
  const bindings = action.field_bindings as Array<{ fieldKey: string; value?: unknown }> | null;

  if (!bindings || !Array.isArray(bindings)) {
    return undefined;
  }

  const descBinding = bindings.find((b) => b.fieldKey === 'description');
  return descBinding?.value;
}

/**
 * Extract assignee from events (most recent ASSIGNMENT_OCCURRED).
 */
export function extractAssignee(
  events: Event[]
): { id: string; name: string } | undefined {
  const assignmentEvents = events
    .filter((e) => e.type === 'ASSIGNMENT_OCCURRED' || e.type === 'ASSIGNMENT_REMOVED')
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  if (assignmentEvents.length === 0) {
    return undefined;
  }

  const mostRecent = assignmentEvents[0];

  if (mostRecent.type === 'ASSIGNMENT_REMOVED') {
    return undefined;
  }

  const payload = mostRecent.payload as { userId?: string; userName?: string } | null;
  if (payload?.userId) {
    return {
      id: payload.userId,
      name: payload.userName || 'Unknown User',
    };
  }

  return undefined;
}

/**
 * Interpret a single action into an ActionView.
 * This is a pure function - deterministic, idempotent, side-effect free.
 */
export function interpretActionView(
  action: Action,
  events: Event[],
  viewType: ActionViewType = 'task-like'
): ActionView {
  const status = deriveStatus(events);
  const title = extractTitle(action);
  const description = extractDescription(action);
  const assignee = extractAssignee(events);

  return {
    actionId: action.id,
    viewType,
    renderedAt: new Date(),
    data: {
      title,
      description,
      status,
      assignee,
    },
  };
}

// ============================================================================
// SERVICE FUNCTIONS (with database access)
// ============================================================================

/**
 * Get action views for a context.
 * This fetches actions and events, then interprets them into views.
 */
export async function getActionViews(
  contextId: string,
  contextType: ContextType,
  viewType: ActionViewType = 'task-like'
): Promise<ActionView[]> {
  // Fetch actions for the context
  const actions = await actionsService.getActionsByContext(contextId, contextType);

  if (actions.length === 0) {
    return [];
  }

  // Batch fetch events for all actions
  const actionIds = actions.map((a) => a.id);
  const eventsMap = await eventsService.getEventsByActions(actionIds);

  // Interpret each action into a view
  const views = actions.map((action) => {
    const actionEvents = eventsMap.get(action.id) || [];
    return interpretActionView(action, actionEvents, viewType);
  });

  return views;
}

/**
 * Get a single action view by action ID.
 */
export async function getActionViewById(
  actionId: string,
  viewType: ActionViewType = 'task-like'
): Promise<ActionView | null> {
  const action = await actionsService.getActionById(actionId);

  if (!action) {
    return null;
  }

  const events = await eventsService.getEventsByAction(actionId);
  return interpretActionView(action, events, viewType);
}

/**
 * Get action views filtered by derived status.
 */
export async function getActionViewsByStatus(
  contextId: string,
  contextType: ContextType,
  status: DerivedStatus,
  viewType: ActionViewType = 'task-like'
): Promise<ActionView[]> {
  const allViews = await getActionViews(contextId, contextType, viewType);
  return allViews.filter((v) => v.data.status === status);
}

/**
 * Get status summary for a context (count by status).
 */
export async function getStatusSummary(
  contextId: string,
  contextType: ContextType
): Promise<Record<DerivedStatus, number>> {
  const views = await getActionViews(contextId, contextType, 'task-like');

  const summary: Record<DerivedStatus, number> = {
    pending: 0,
    active: 0,
    blocked: 0,
    finished: 0,
  };

  for (const view of views) {
    summary[view.data.status]++;
  }

  return summary;
}
