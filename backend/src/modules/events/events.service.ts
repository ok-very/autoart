/**
 * Events Service
 *
 * Manages Events - the immutable fact log that records what occurred.
 * Events are the source of truth for deriving all state through interpretation.
 *
 * Key principles:
 * - Events are append-only (no UPDATE, no DELETE)
 * - Events record facts, not state transitions
 * - Event types use fact-based naming (WORK_FINISHED, not ACTION_COMPLETED)
 */

import { sql } from 'kysely';

import { getSystemEventTypes } from './event-visibility.js';
import { db } from '../../db/client.js';
import type { Event, ContextType } from '../../db/schema.js';

export interface CreateEventInput {
  contextId: string;
  contextType: ContextType;
  actionId?: string;
  type: string;
  payload?: Record<string, unknown>;
  actorId?: string;
}

/**
 * Emit a new event (append to the fact log).
 * This is the ONLY write operation for events - they are immutable.
 *
 * After inserting the event, this triggers a synchronous projection refresh
 * to ensure read-after-write consistency for UI consumers.
 */
export async function emitEvent(input: CreateEventInput): Promise<Event> {
  // Guard: Stage context is deprecated
  if (input.contextType === 'stage') {
    throw new Error('Stage context is deprecated; use subprocess context with stage metadata');
  }

  const event = await db
    .insertInto('events')
    .values({
      context_id: input.contextId,
      context_type: input.contextType,
      action_id: input.actionId || null,
      type: input.type,
      payload: sql`${JSON.stringify(input.payload || {})}::jsonb`,
      actor_id: input.actorId || null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Synchronous projection refresh - await for consistency
  // This ensures that reads immediately after emitEvent() return updated data
  if (event.action_id) {
    // Dynamically import to avoid circular dependency
    const { refreshWorkflowSurface } = await import('../projections/workflow-surface.projector.js');
    await refreshWorkflowSurface(event.context_id, event.context_type);
  }

  // Handle reference events - project to action_references table
  if (event.type === 'ACTION_REFERENCE_ADDED' || event.type === 'ACTION_REFERENCE_REMOVED') {
    const { projectActionReference } = await import('../projections/action-references.projector.js');
    // Transform database event to shared Event format
    await projectActionReference({
      id: event.id,
      type: event.type,
      actionId: event.action_id,
      contextId: event.context_id,
      contextType: event.context_type,
      payload: event.payload as Record<string, unknown>,
      actorId: event.actor_id,
      occurredAt: event.occurred_at,
    });
  }

  return event;
}

/**
 * Get an event by ID (for reference/debugging).
 */
export async function getEventById(id: string): Promise<Event | undefined> {
  return db
    .selectFrom('events')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

/**
 * Get all events for a specific context.
 * Events are returned in chronological order (oldest first) for correct interpretation.
 */
export async function getEventsByContext(
  contextId: string,
  contextType: ContextType
): Promise<Event[]> {
  return db
    .selectFrom('events')
    .selectAll()
    .where('context_id', '=', contextId)
    .where('context_type', '=', contextType)
    .orderBy('occurred_at', 'asc')
    .execute();
}

/**
 * Get all events for a specific action.
 * This is the core query for interpreting action state.
 */
export async function getEventsByAction(actionId: string): Promise<Event[]> {
  return db
    .selectFrom('events')
    .selectAll()
    .where('action_id', '=', actionId)
    .orderBy('occurred_at', 'asc')
    .execute();
}

/**
 * Get events by type within a context.
 */
export async function getEventsByType(
  contextId: string,
  contextType: ContextType,
  eventType: string
): Promise<Event[]> {
  return db
    .selectFrom('events')
    .selectAll()
    .where('context_id', '=', contextId)
    .where('context_type', '=', contextType)
    .where('type', '=', eventType)
    .orderBy('occurred_at', 'asc')
    .execute();
}

/**
 * Get the most recent event of a specific type for an action.
 * Useful for determining current state (e.g., most recent work event).
 */
export async function getLatestEventByType(
  actionId: string,
  eventType: string
): Promise<Event | undefined> {
  return db
    .selectFrom('events')
    .selectAll()
    .where('action_id', '=', actionId)
    .where('type', '=', eventType)
    .orderBy('occurred_at', 'desc')
    .limit(1)
    .executeTakeFirst();
}

/**
 * Get the most recent work-related event for an action.
 * Work events: WORK_STARTED, WORK_STOPPED, WORK_FINISHED, WORK_BLOCKED, WORK_UNBLOCKED
 */
export async function getLatestWorkEvent(actionId: string): Promise<Event | undefined> {
  const workEventTypes = [
    'WORK_STARTED',
    'WORK_STOPPED',
    'WORK_FINISHED',
    'WORK_BLOCKED',
    'WORK_UNBLOCKED',
  ];

  return db
    .selectFrom('events')
    .selectAll()
    .where('action_id', '=', actionId)
    .where('type', 'in', workEventTypes)
    .orderBy('occurred_at', 'desc')
    .limit(1)
    .executeTakeFirst();
}

/**
 * Check if a WORK_FINISHED event exists for an action.
 */
export async function hasFinishedEvent(actionId: string): Promise<boolean> {
  const event = await db
    .selectFrom('events')
    .select('id')
    .where('action_id', '=', actionId)
    .where('type', '=', 'WORK_FINISHED')
    .limit(1)
    .executeTakeFirst();

  return !!event;
}

/**
 * Get events in a time range for a context.
 */
export async function getEventsByTimeRange(
  contextId: string,
  contextType: ContextType,
  startTime: Date,
  endTime: Date
): Promise<Event[]> {
  return db
    .selectFrom('events')
    .selectAll()
    .where('context_id', '=', contextId)
    .where('context_type', '=', contextType)
    .where('occurred_at', '>=', startTime)
    .where('occurred_at', '<=', endTime)
    .orderBy('occurred_at', 'asc')
    .execute();
}

/**
 * Count events for a context.
 */
export async function countEventsByContext(
  contextId: string,
  contextType: ContextType
): Promise<number> {
  const result = await db
    .selectFrom('events')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('context_id', '=', contextId)
    .where('context_type', '=', contextType)
    .executeTakeFirst();

  return parseInt(result?.count || '0', 10);
}

/**
 * Get all events for multiple actions (batch query).
 * Returns a map of actionId -> Event[]
 */
export async function getEventsByActions(
  actionIds: string[]
): Promise<Map<string, Event[]>> {
  if (actionIds.length === 0) {
    return new Map();
  }

  const events = await db
    .selectFrom('events')
    .selectAll()
    .where('action_id', 'in', actionIds)
    .orderBy('occurred_at', 'asc')
    .execute();

  const eventMap = new Map<string, Event[]>();

  for (const event of events) {
    if (event.action_id) {
      const existing = eventMap.get(event.action_id) || [];
      existing.push(event);
      eventMap.set(event.action_id, existing);
    }
  }

  return eventMap;
}

// ============================================================================
// PROJECT LOG QUERIES (Paginated)
// ============================================================================

/**
 * Options for paginated event queries
 */
export interface GetEventsPaginatedOptions {
  contextId: string;
  contextType: ContextType;
  limit?: number;
  offset?: number;
  includeSystem?: boolean;
  types?: string[];
  actorId?: string;
  actionId?: string;
}

/**
 * Paginated response for events
 */
export interface EventsPage {
  events: Event[];
  total: number;
  hasMore: boolean;
}

/**
 * Get events for a context with pagination and filtering.
 * Used by the Project Log view.
 *
 * - Events are returned in reverse chronological order (newest first)
 * - System events are excluded by default
 * - Supports filtering by type, actor, and action
 */
export async function getEventsByContextPaginated(
  options: GetEventsPaginatedOptions
): Promise<EventsPage> {
  const {
    contextId,
    contextType,
    limit = 50,
    offset = 0,
    includeSystem = false,
    types,
    actorId,
    actionId,
  } = options;

  // Build base query
  let query = db
    .selectFrom('events')
    .where('context_id', '=', contextId)
    .where('context_type', '=', contextType);

  // Filter out system events unless explicitly included
  if (!includeSystem) {
    const systemTypes = getSystemEventTypes();
    if (systemTypes.length > 0) {
      query = query.where('type', 'not in', systemTypes);
    }
  }

  // Optional filters
  if (types && types.length > 0) {
    query = query.where('type', 'in', types);
  }
  if (actorId) {
    query = query.where('actor_id', '=', actorId);
  }
  if (actionId) {
    query = query.where('action_id', '=', actionId);
  }

  // Get total count (before pagination)
  const countResult = await query
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .executeTakeFirst();
  const total = parseInt(countResult?.count || '0', 10);

  // Get paginated events (newest first for log display)
  const events = await query
    .selectAll()
    .orderBy('occurred_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  return {
    events,
    total,
    hasMore: offset + events.length < total,
  };
}
