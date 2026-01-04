/**
 * Workflow Surface Projector
 *
 * Materializes the workflow surface tree from Actions and Events.
 * This is a "dumb pipe" that:
 * 1. Reads actions + events
 * 2. Calls the interpreter (pure, deterministic)
 * 3. Writes only UI-facing cached/ordering fields
 *
 * The projector NEVER defines semantics. All status, lifecycle, and business
 * logic rules live in the interpreter.
 *
 * Key invariants:
 * - Idempotent: multiple runs produce identical results
 * - Synchronous: called from emitEvent() for guaranteed consistency
 * - Semantic-free: no if-statements about status or lifecycle
 */

import { db } from '../../db/client.js';
import type { ContextType, NewWorkflowSurfaceNode } from '../../db/schema.js';
import * as actionsService from '../actions/actions.service.js';
import * as eventsService from '../events/events.service.js';
import * as interpreterService from '../interpreter/interpreter.service.js';

const DEFAULT_SURFACE_TYPE = 'workflow_table';

/**
 * Project the workflow surface for a given context.
 * This is the main entry point called after events are emitted.
 *
 * The projection:
 * 1. Loads all actions for the context
 * 2. Batch loads events for those actions
 * 3. Calls the interpreter to build the surface tree
 * 4. Upserts all nodes to the database
 * 5. Deletes stale nodes that no longer exist
 */
export async function projectWorkflowSurface(
  contextId: string,
  contextType: ContextType,
  surfaceType: string = DEFAULT_SURFACE_TYPE
): Promise<void> {
  // 1. Load actions for the context
  const actions = await actionsService.getActionsByContext(contextId, contextType);

  if (actions.length === 0) {
    // No actions - delete any existing surface nodes
    await db
      .deleteFrom('workflow_surface_nodes')
      .where('surface_type', '=', surfaceType)
      .where('context_id', '=', contextId)
      .where('context_type', '=', contextType)
      .execute();
    return;
  }

  // 2. Batch load events for all actions
  const actionIds = actions.map((a) => a.id);
  const eventsByAction = await eventsService.getEventsByActions(actionIds);

  // 3. Call interpreter to build the surface tree (pure, deterministic)
  const surfaceNodes = interpreterService.buildWorkflowSurfaceTree(
    actions,
    eventsByAction,
    surfaceType
  );

  // 4. Upsert all nodes
  const now = new Date();
  const newNodes: NewWorkflowSurfaceNode[] = surfaceNodes.map((node) => ({
    surface_type: surfaceType,
    context_id: contextId,
    context_type: contextType,
    action_id: node.actionId,
    parent_action_id: node.parentActionId,
    depth: node.depth,
    position: node.position,
    payload: node.payload,
    flags: node.flags || {},
    rendered_at: now,
    last_event_occurred_at: node.lastEventOccurredAt,
  }));

  // Use transaction for atomicity
  await db.transaction().execute(async (trx) => {
    // Delete existing nodes for this context + surface type
    await trx
      .deleteFrom('workflow_surface_nodes')
      .where('surface_type', '=', surfaceType)
      .where('context_id', '=', contextId)
      .where('context_type', '=', contextType)
      .execute();

    // Insert new nodes (if any)
    if (newNodes.length > 0) {
      await trx
        .insertInto('workflow_surface_nodes')
        .values(newNodes)
        .execute();
    }
  });
}

/**
 * Refresh workflow surface triggered by an event emission.
 * This is the hook called from emitEvent().
 */
export async function refreshWorkflowSurface(
  contextId: string,
  contextType: ContextType
): Promise<void> {
  // For now, only project the default surface type
  // Future: could project multiple surface types if needed
  await projectWorkflowSurface(contextId, contextType, DEFAULT_SURFACE_TYPE);
}

/**
 * Get workflow surface nodes for a context.
 * Returns nodes ordered for tree display (parent first, then children by position).
 */
export async function getWorkflowSurfaceNodes(
  contextId: string,
  contextType: ContextType,
  surfaceType: string = DEFAULT_SURFACE_TYPE
): Promise<interpreterService.WorkflowSurfaceNode[]> {
  const rows = await db
    .selectFrom('workflow_surface_nodes')
    .selectAll()
    .where('surface_type', '=', surfaceType)
    .where('context_id', '=', contextId)
    .where('context_type', '=', contextType)
    .orderBy('depth', 'asc')
    .orderBy('position', 'asc')
    .execute();

  return rows.map((row) => ({
    actionId: row.action_id,
    parentActionId: row.parent_action_id,
    depth: row.depth,
    position: row.position,
    payload: row.payload as interpreterService.TaskLikeViewPayload,
    flags: row.flags as { cycleDetected?: boolean; hasChildren?: boolean } | undefined,
    renderedAt: new Date(row.rendered_at),
    lastEventOccurredAt: new Date(row.last_event_occurred_at),
  }));
}

/**
 * Force refresh all surfaces for a context (debug/admin use).
 */
export async function forceRefreshAllSurfaces(
  contextId: string,
  contextType: ContextType
): Promise<void> {
  await projectWorkflowSurface(contextId, contextType, DEFAULT_SURFACE_TYPE);
  // Future: add other surface types here
}
