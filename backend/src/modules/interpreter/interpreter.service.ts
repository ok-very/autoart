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
import type { ContextType } from '../../db/schema.js';
import * as actionsService from '../actions/actions.service.js';
import * as eventsService from '../events/events.service.js';

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
// DEPENDENCY INTERPRETATION (Pure Functions)
// ============================================================================

/**
 * Extract current dependencies from events.
 * Returns a Set of actionIds that this action depends on.
 *
 * Semantics:
 * - DEPENDENCY_ADDED: Add edge
 * - DEPENDENCY_REMOVED: Remove edge (tombstone)
 * - Last-write-wins per edge (process chronologically)
 */
export function extractDependencies(events: Event[]): Set<string> {
  const dependencies = new Set<string>();

  // Sort events chronologically (oldest first)
  const sortedEvents = events
    .filter((e) => e.type === 'DEPENDENCY_ADDED' || e.type === 'DEPENDENCY_REMOVED')
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  for (const event of sortedEvents) {
    const payload = event.payload as { dependsOnActionId?: string } | null;
    const dependsOnId = payload?.dependsOnActionId;

    if (!dependsOnId) continue;

    if (event.type === 'DEPENDENCY_ADDED') {
      dependencies.add(dependsOnId);
    } else if (event.type === 'DEPENDENCY_REMOVED') {
      dependencies.delete(dependsOnId);
    }
  }

  return dependencies;
}

/**
 * Extract row order from WORKFLOW_ROW_MOVED events.
 * Returns a Map of actionId → position for a specific surface.
 *
 * Note: This builds positions based on "after" relationships.
 * Actions without move events use their created_at order.
 */
export function extractRowOrder(
  events: Event[],
  surfaceType: string
): Map<string, { afterActionId: string | null; timestamp: Date }> {
  const moveMap = new Map<string, { afterActionId: string | null; timestamp: Date }>();

  // Sort events chronologically (oldest first) - later events override
  const sortedEvents = events
    .filter((e) => e.type === 'WORKFLOW_ROW_MOVED')
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  for (const event of sortedEvents) {
    const payload = event.payload as {
      surfaceType?: string;
      afterActionId?: string | null;
    } | null;

    if (payload?.surfaceType !== surfaceType) continue;

    const actionId = event.action_id;
    if (!actionId) continue;

    moveMap.set(actionId, {
      afterActionId: payload.afterActionId ?? null,
      timestamp: new Date(event.occurred_at),
    });
  }

  return moveMap;
}

// ============================================================================
// WORKFLOW SURFACE TREE BUILDING (Pure Functions)
// ============================================================================

export interface WorkflowSurfaceNode {
  actionId: string;
  parentActionId: string | null;
  depth: number;
  position: number;
  payload: TaskLikeViewPayload;
  flags?: {
    cycleDetected?: boolean;
    hasChildren?: boolean;
  };
  renderedAt: Date;
  lastEventOccurredAt: Date;
}

/**
 * Build a workflow surface tree from actions and events.
 * This is a pure function - deterministic, idempotent, side-effect free.
 *
 * Dependency semantics:
 * - DEPENDENCY_ADDED on Action A with { dependsOnActionId: B }
 *   means "A is blocked by B" / "B must complete before A"
 * - Tree representation: A is parent, B is child (B shown nested under A)
 *
 * The tree is built by:
 * 1. Computing ActionViews for each action
 * 2. Building dependency graph from events
 * 3. Building tree with DFS, detecting cycles
 * 4. Sorting siblings by position (from WORKFLOW_ROW_MOVED or created_at)
 */
export function buildWorkflowSurfaceTree(
  actions: Action[],
  eventsByAction: Map<string, Event[]>,
  surfaceType: string = 'workflow_table'
): WorkflowSurfaceNode[] {
  if (actions.length === 0) return [];

  // 1. Collect all events for row ordering
  const allEvents: Event[] = [];
  for (const events of eventsByAction.values()) {
    allEvents.push(...events);
  }

  // 2. Build dependency graph: blockedActionId -> Set<prerequisiteId>
  // "A is blocked by B" means B is a child of A in the tree
  const blockedBy = new Map<string, Set<string>>();

  for (const action of actions) {
    const events = eventsByAction.get(action.id) || [];
    const deps = extractDependencies(events);
    if (deps.size > 0) {
      blockedBy.set(action.id, deps);
    }
  }

  // 3. Build reverse lookup: prerequisiteId -> Set<blockedActionId>
  // This tells us which actions are blocked by a given action
  const blocks = new Map<string, Set<string>>();
  for (const [blockedId, prereqs] of blockedBy) {
    for (const prereqId of prereqs) {
      if (!blocks.has(prereqId)) {
        blocks.set(prereqId, new Set());
      }
      blocks.get(prereqId)!.add(blockedId);
    }
  }

  // 4. Determine roots: actions that are not prerequisites of any other
  // An action is a root if no other action is blocked by it,
  // OR if it has no dependencies (standalone action)
  const actionSet = new Set(actions.map((a) => a.id));
  const isPrereq = new Set<string>();
  for (const deps of blockedBy.values()) {
    for (const dep of deps) {
      if (actionSet.has(dep)) {
        isPrereq.add(dep);
      }
    }
  }

  // Roots are actions that are not prerequisites of others within this context
  const rootIds = actions.filter((a) => !isPrereq.has(a.id)).map((a) => a.id);

  // 5. Extract row ordering
  const rowOrder = extractRowOrder(allEvents, surfaceType);

  // 6. Create action lookup and compute ActionViews
  const actionById = new Map(actions.map((a) => [a.id, a]));
  const viewByActionId = new Map<string, ActionView>();

  for (const action of actions) {
    const events = eventsByAction.get(action.id) || [];
    viewByActionId.set(action.id, interpretActionView(action, events, 'task-like'));
  }

  // 7. Helper to get last event timestamp
  function getLastEventTime(actionId: string): Date {
    const events = eventsByAction.get(actionId) || [];
    if (events.length === 0) {
      const action = actionById.get(actionId);
      return action ? new Date(action.created_at) : new Date();
    }
    return new Date(
      Math.max(...events.map((e) => new Date(e.occurred_at).getTime()))
    );
  }

  // 8. Sort function for siblings
  function sortSiblings(ids: string[]): string[] {
    return ids.sort((a, b) => {
      const orderA = rowOrder.get(a);
      const orderB = rowOrder.get(b);

      // If both have explicit order, sort by afterActionId chain (complex)
      // For simplicity, use timestamp of move event as tie-breaker
      if (orderA && orderB) {
        return orderA.timestamp.getTime() - orderB.timestamp.getTime();
      }

      // If only one has order, it comes after unordered items
      if (orderA && !orderB) return 1;
      if (!orderA && orderB) return -1;

      // Default: sort by action created_at
      const actionA = actionById.get(a);
      const actionB = actionById.get(b);
      if (actionA && actionB) {
        return new Date(actionA.created_at).getTime() - new Date(actionB.created_at).getTime();
      }
      return 0;
    });
  }

  // 9. Build tree with DFS
  const result: WorkflowSurfaceNode[] = [];
  const _visited = new Set<string>();

  function buildNode(
    actionId: string,
    parentActionId: string | null,
    depth: number,
    position: number,
    pathSet: Set<string>
  ): WorkflowSurfaceNode | null {
    const action = actionById.get(actionId);
    const view = viewByActionId.get(actionId);

    if (!action || !view) return null;

    // Cycle detection
    const cycleDetected = pathSet.has(actionId);

    // Get children (prerequisites that this action depends on)
    const deps = blockedBy.get(actionId);
    const childIds = deps ? Array.from(deps).filter((id) => actionSet.has(id)) : [];
    const hasChildren = childIds.length > 0;

    const node: WorkflowSurfaceNode = {
      actionId,
      parentActionId,
      depth,
      position,
      payload: view.data,
      flags: {
        cycleDetected,
        hasChildren,
      },
      renderedAt: new Date(),
      lastEventOccurredAt: getLastEventTime(actionId),
    };

    result.push(node);

    // If cycle detected, don't descend further
    if (cycleDetected) {
      return node;
    }

    // Mark as visited in current path
    const newPathSet = new Set(pathSet);
    newPathSet.add(actionId);

    // Recursively build children
    if (hasChildren) {
      const sortedChildIds = sortSiblings(childIds);
      let childPosition = 0;
      for (const childId of sortedChildIds) {
        buildNode(childId, actionId, depth + 1, childPosition, newPathSet);
        childPosition++;
      }
    }

    return node;
  }

  // 10. Build from roots
  const sortedRootIds = sortSiblings(rootIds);
  let rootPosition = 0;
  for (const rootId of sortedRootIds) {
    buildNode(rootId, null, 0, rootPosition, new Set());
    rootPosition++;
  }

  return result;
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

// ============================================================================
// CSV INTERPRETATION LAYER
// ============================================================================

import { defaultMappingRules } from './mappings/index.js';
import {
  MappingContext,
  MappingRule,
  applyMappingRules,
  type InterpretationOutput,
} from './mappings/types.js';

export type { MappingContext, MappingRule, InterpretationOutput };

/**
 * CSV row input for interpretation.
 */
export interface CsvRowInput {
  /** The main text content (task name / subitem description) */
  text: string;
  /** Status value from CSV */
  status?: string;
  /** Target date if present */
  targetDate?: string;
  /** Parent item title for context */
  parentTitle?: string;
  /** Stage name for context */
  stageName?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Interpretation plan - separates semantic parsing from event commitment.
 * 
 * Enables classification of CSV rows into:
 * - fact_candidate: Observable outcomes to be reviewed before commit
 * - work_event: Status-derived lifecycle events (auto-commit)
 * - field_value: Extracted dates, assignees, etc. (auto-commit)
 * - action_hint: Preparatory/intended work (no commit, classification only)
 */
export interface InterpretationPlan {
  /** All interpretation outputs from rule matching */
  outputs: InterpretationOutput[];
  /** Status-derived work event (if status maps to lifecycle) */
  statusEvent?: InterpretationOutput;
  /** Original CSV row input for reference */
  raw: CsvRowInput;
}

/**
 * Interpret a CSV row into an InterpretationPlan.
 * 
 * Returns structured outputs that enable:
 * - Classification based on output kind (fact_candidate vs action_hint)
 * - Deferred commitment (fact_candidate can be reviewed before commit)
 * - Auto-commitment of status-derived work events
 *
 * @param row - The CSV row data
 * @param rules - Mapping rules to apply (defaults to all known rules)
 * @returns InterpretationPlan with outputs and status event
 */
export function interpretCsvRowPlan(
  row: CsvRowInput,
  rules: MappingRule[] = defaultMappingRules
): InterpretationPlan {
  const ctx: MappingContext = {
    text: row.text,
    status: row.status,
    targetDate: row.targetDate,
    parentTitle: row.parentTitle,
    stageName: row.stageName,
    metadata: row.metadata,
  };

  // Apply mapping rules to get InterpretationOutput[]
  const outputs = applyMappingRules(ctx, rules);

  // Derive work lifecycle event from status column
  const workEventType = mapStatusToWorkEvent(row.status);
  const statusEvent: InterpretationOutput | undefined = workEventType
    ? {
      kind: 'work_event',
      eventType: workEventType,
      source: 'csv-status',
    }
    : undefined;

  return {
    outputs,
    statusEvent,
    raw: row,
  };
}

/**
 * Interpret multiple subitems for a parent item.
 *
 * @param subitems - Array of subitem texts
 * @param parentTitle - Title of the parent item
 * @param stageName - Current stage name for context
 * @param rules - Mapping rules to apply
 * @returns Array of interpretation plans for all subitems
 */
export function interpretSubitems(
  subitems: Array<{ text: string; status?: string; targetDate?: string }>,
  parentTitle: string,
  stageName?: string,
  rules: MappingRule[] = defaultMappingRules
): InterpretationPlan[] {
  return subitems.map((subitem) =>
    interpretCsvRowPlan(
      {
        text: subitem.text,
        status: subitem.status,
        targetDate: subitem.targetDate,
        parentTitle,
        stageName,
      },
      rules
    )
  );
}


/**
 * Map a CSV status value to a work lifecycle event type.
 *
 * @param status - The status value from CSV
 * @returns The event type to emit, or null if no event should be emitted
 */
export function mapStatusToWorkEvent(
  status?: string
): 'WORK_STARTED' | 'WORK_FINISHED' | 'WORK_BLOCKED' | null {
  if (!status) return null;

  const normalized = status.toLowerCase().trim();

  // Finished states
  if (['executed', 'done', 'completed', 'finished'].includes(normalized)) {
    return 'WORK_FINISHED';
  }

  // Active states
  if (['working on it', 'in progress', 'active', 'started'].includes(normalized)) {
    return 'WORK_STARTED';
  }

  // Blocked states
  if (['blocked', 'stuck', 'waiting'].includes(normalized)) {
    return 'WORK_BLOCKED';
  }

  // Milestone is treated as finished
  if (normalized === 'milestone') {
    return 'WORK_FINISHED';
  }

  // Not started / Not applicable - no event needed
  return null;
}
