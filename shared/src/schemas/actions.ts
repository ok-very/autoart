/**
 * Actions & Events Schemas
 *
 * Defines the foundational primitives for the interpretive model:
 * - Actions declare intent (what should/could happen)
 * - Events record truth (what occurred)
 * - ActionViews are derived, non-reified projections for UI rendering
 *
 * Core principle: Actions and Events are the only writable units of meaning.
 * Views are never written, addressed, or mutated.
 */

import { z } from 'zod';

// ============================================================================
// CONTEXT TYPE
// ============================================================================

/**
 * Context type enum - defines the scope of an action/event
 * Phase 1 focuses on 'subprocess', but the system is designed to scale
 * to stage, process, project, and eventually record-level contexts.
 */
export const ContextTypeSchema = z.enum([
  'subprocess',
  'stage',
  'process',
  'project',
  'record',
]);
export type ContextType = z.infer<typeof ContextTypeSchema>;

// ============================================================================
// EVENT TYPES (Fact-based naming)
// ============================================================================

/**
 * Event type catalog - fact-based names, not state-based
 * These describe what occurred, not lifecycle stages.
 */
export const EventTypeSchema = z.enum([
  // Action lifecycle events
  'ACTION_DECLARED',      // An action was created
  'WORK_STARTED',         // Work began on an action
  'WORK_STOPPED',         // Work was paused
  'WORK_FINISHED',        // Work was completed
  'WORK_BLOCKED',         // Action became blocked
  'WORK_UNBLOCKED',       // Blockage was resolved

  // Field events
  'FIELD_VALUE_RECORDED', // A field value was captured

  // Domain fact events (payload-discriminated)
  'FACT_RECORDED',        // A domain fact occurred: payload { factKind, ...factPayload }

  // Assignment events
  'ASSIGNMENT_OCCURRED',  // Someone was assigned
  'ASSIGNMENT_REMOVED',   // Assignment was removed

  // Dependency events (workflow surface)
  'DEPENDENCY_ADDED',     // Action depends on another: payload { dependsOnActionId }
  'DEPENDENCY_REMOVED',   // Dependency removed: payload { dependsOnActionId }

  // Reference events (action-record links)
  'ACTION_REFERENCE_ADDED',   // Action references a record: payload { sourceRecordId, targetFieldKey, snapshotValue? }
  'ACTION_REFERENCE_REMOVED', // Reference removed: payload { sourceRecordId, targetFieldKey }

  // Ordering events (workflow surface)
  'WORKFLOW_ROW_MOVED',   // Row reordered: payload { surfaceType, afterActionId }
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Field binding - maps action parameters to Field definitions
 *
 * Common fieldKey vocabulary:
 * - 'title': Display name for the action
 * - 'description': Detailed description (may be TipTap JSON)
 * - 'dueDate': Target completion date (ISO string)
 * - 'assignee': Person assigned to the action
 * - 'priority': Priority scoring (see Priority Pattern below)
 *
 * Priority Pattern (aligned with email app):
 * Use for actions that need explicit priority beyond dependency-derived ordering.
 * Example: { fieldKey: 'priority', value: { score: 4, factors: ['urgency_keyword', 'external_sender'] } }
 * - score: 1-5 (1=lowest, 5=highest)
 * - factors: Array of strings explaining why this priority was assigned
 *
 * Stakeholder Pattern (aligned with email app):
 * Captures sender/actor classification for communication-related actions.
 * Example: { fieldKey: 'stakeholder', value: { type: 'External', domain: 'client.com' } }
 * - type: 'Internal' | 'External' | 'Government' | 'System'
 * - domain: Optional email domain for context
 *
 * Duration/Scheduling Pattern:
 * - 'scheduleMode': 'explicit' | 'anchor_start' | 'anchor_due'
 * - 'durationDays': number (calendar or working days)
 * - 'startDate': ISO string (anchor when scheduleMode='anchor_start')
 * - 'dueDate': ISO string (anchor when scheduleMode='anchor_due')
 *
 * When 'explicit': both startDate and dueDate are set manually
 * When 'anchor_start': startDate + durationDays computes dueDate
 * When 'anchor_due': dueDate - durationDays computes startDate
 */

export const ScheduleModeSchema = z.enum(['explicit', 'anchor_start', 'anchor_due']);
export type ScheduleMode = z.infer<typeof ScheduleModeSchema>;
export const FieldBindingSchema = z.object({
  fieldKey: z.string(),
  fieldDefId: z.string().uuid().optional(),
  value: z.unknown().optional(),
});
export type FieldBinding = z.infer<typeof FieldBindingSchema>;

/**
 * Action schema - intent declaration
 * Actions declare that something should or could happen.
 * They do NOT contain: status, progress, completed_at, or assignee.
 */
export const ActionSchema = z.object({
  id: z.string().uuid(),
  contextId: z.string().uuid(),
  contextType: ContextTypeSchema,
  parentActionId: z.string().uuid().nullable().optional(),
  type: z.string().max(100),
  fieldBindings: z.array(FieldBindingSchema).default([]),
  createdAt: z.coerce.date(),
});
export type Action = z.infer<typeof ActionSchema>;

/**
 * Create action input
 */
export const CreateActionInputSchema = z.object({
  contextId: z.string().uuid(),
  contextType: ContextTypeSchema,
  parentActionId: z.string().uuid().nullish(),
  type: z.string().max(100),
  fieldBindings: z.array(FieldBindingSchema).optional().default([]),
});
export type CreateActionInput = z.infer<typeof CreateActionInputSchema>;

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Event schema - immutable fact record
 * Events record what occurred. They are append-only.
 */
export const EventSchema = z.object({
  id: z.string().uuid(),
  contextId: z.string().uuid(),
  contextType: ContextTypeSchema,
  actionId: z.string().uuid().nullable(),
  type: z.string().max(100),
  payload: z.record(z.string(), z.unknown()).default({}),
  actorId: z.string().uuid().nullable(),
  occurredAt: z.coerce.date(),
});
export type Event = z.infer<typeof EventSchema>;

/**
 * Create event input (emit event)
 */
export const CreateEventInputSchema = z.object({
  contextId: z.string().uuid(),
  contextType: ContextTypeSchema,
  actionId: z.string().uuid().optional(),
  type: z.string().max(100),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

// ============================================================================
// ACTION VIEW (Non-Reified Projection)
// ============================================================================

/**
 * Action view type - the kind of UI rendering
 */
export const ActionViewTypeSchema = z.enum([
  'task-like',
  'kanban-card',
  'timeline-row',
]);
export type ActionViewType = z.infer<typeof ActionViewTypeSchema>;

/**
 * Derived status - computed from events, never stored
 */
export const DerivedStatusSchema = z.enum([
  'pending',   // No events or no work events
  'active',    // Most recent work event is WORK_STARTED
  'blocked',   // Most recent work event is WORK_BLOCKED
  'finished',  // Any WORK_FINISHED event exists
]);
export type DerivedStatus = z.infer<typeof DerivedStatusSchema>;

/**
 * Task-like view payload - the shape for task UI affordances
 * This is computed on-demand, never stored.
 *
 * Note: Decompositions are derived from Field schemas, not nested here.
 * The recursive structure is handled at the interpretation layer, not in the schema.
 */
export const TaskLikeViewPayloadSchema = z.object({
  title: z.string(),
  description: z.unknown().optional(), // TipTap JSON
  status: DerivedStatusSchema,
  assignees: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().optional(),
  })).default([]),
  dueDate: z.string().optional(),
  percentComplete: z.number().min(0).max(100).optional(),
});
export type TaskLikeViewPayload = z.infer<typeof TaskLikeViewPayloadSchema>;

/**
 * Action view - non-reified, disposable, non-addressable
 *
 * Rules:
 * - No primary key (actionId is just a reference, not an identity)
 * - No persistence
 * - No external references
 * - Safe to discard and regenerate
 */
export const ActionViewSchema = z.object({
  actionId: z.string().uuid(),
  viewType: ActionViewTypeSchema,
  renderedAt: z.coerce.date(),
  data: TaskLikeViewPayloadSchema, // Can be union with other view payloads
});
export type ActionView = z.infer<typeof ActionViewSchema>;

// ============================================================================
// API RESPONSES
// ============================================================================

export const ActionResponseSchema = z.object({
  action: ActionSchema,
});
export type ActionResponse = z.infer<typeof ActionResponseSchema>;

export const ActionsResponseSchema = z.object({
  actions: z.array(ActionSchema),
});
export type ActionsResponse = z.infer<typeof ActionsResponseSchema>;

export const EventResponseSchema = z.object({
  event: EventSchema,
});
export type EventResponse = z.infer<typeof EventResponseSchema>;

export const EventsResponseSchema = z.object({
  events: z.array(EventSchema),
});
export type EventsResponse = z.infer<typeof EventsResponseSchema>;

export const ActionViewsResponseSchema = z.object({
  views: z.array(ActionViewSchema),
});
export type ActionViewsResponse = z.infer<typeof ActionViewsResponseSchema>;

// ============================================================================
// WORKFLOW SURFACE (Materialized Projection)
// ============================================================================

/**
 * Surface node flags - display hints for UI
 */
export const WorkflowSurfaceNodeFlagsSchema = z.object({
  cycleDetected: z.boolean().optional(),
  hasChildren: z.boolean().optional(),
});
export type WorkflowSurfaceNodeFlags = z.infer<typeof WorkflowSurfaceNodeFlagsSchema>;

/**
 * Workflow surface node - materialized projection for tree display
 *
 * Dependency semantics:
 * - DEPENDENCY_ADDED on Action A with { dependsOnActionId: B }
 *   means "A is blocked by B" / "B must complete before A"
 * - Tree representation: A is parent, B is child (B shown nested under A)
 */
export const WorkflowSurfaceNodeSchema = z.object({
  id: z.string().uuid(),
  surfaceType: z.string(),
  contextId: z.string().uuid(),
  contextType: ContextTypeSchema,
  actionId: z.string().uuid(),
  parentActionId: z.string().uuid().nullable(),
  depth: z.number().int().min(0),
  position: z.number().int().min(0),
  payload: TaskLikeViewPayloadSchema,
  flags: WorkflowSurfaceNodeFlagsSchema.optional(),
  renderedAt: z.coerce.date(),
  lastEventOccurredAt: z.coerce.date(),
});
export type WorkflowSurfaceNode = z.infer<typeof WorkflowSurfaceNodeSchema>;

/**
 * Workflow surface response
 */
export const WorkflowSurfaceResponseSchema = z.object({
  nodes: z.array(WorkflowSurfaceNodeSchema),
});
export type WorkflowSurfaceResponse = z.infer<typeof WorkflowSurfaceResponseSchema>;

// ============================================================================
// DEPENDENCY EVENT PAYLOADS
// ============================================================================

/**
 * Payload for DEPENDENCY_ADDED / DEPENDENCY_REMOVED events
 */
export const DependencyEventPayloadSchema = z.object({
  dependsOnActionId: z.string().uuid(),
});
export type DependencyEventPayload = z.infer<typeof DependencyEventPayloadSchema>;

/**
 * Payload for WORKFLOW_ROW_MOVED events
 */
export const WorkflowRowMovedPayloadSchema = z.object({
  surfaceType: z.string(),
  afterActionId: z.string().uuid().nullable(),
});
export type WorkflowRowMovedPayload = z.infer<typeof WorkflowRowMovedPayloadSchema>;

/**
 * Input for adding/removing dependencies
 */
export const DependencyInputSchema = z.object({
  dependsOnActionId: z.string().uuid(),
});
export type DependencyInput = z.infer<typeof DependencyInputSchema>;

/**
 * Input for moving workflow rows
 */
export const MoveWorkflowRowInputSchema = z.object({
  surfaceType: z.string().default('workflow_table'),
  afterActionId: z.string().uuid().nullable(),
});
export type MoveWorkflowRowInput = z.infer<typeof MoveWorkflowRowInputSchema>;

// ============================================================================
// ACTION REFERENCE EVENT PAYLOADS
// ============================================================================

/**
 * Payload for ACTION_REFERENCE_ADDED events
 */
export const ActionReferenceAddedPayloadSchema = z.object({
  sourceRecordId: z.string().uuid(),
  targetFieldKey: z.string(),
  snapshotValue: z.unknown().optional(),
});
export type ActionReferenceAddedPayload = z.infer<typeof ActionReferenceAddedPayloadSchema>;

/**
 * Payload for ACTION_REFERENCE_REMOVED events
 */
export const ActionReferenceRemovedPayloadSchema = z.object({
  sourceRecordId: z.string().uuid(),
  targetFieldKey: z.string(),
});
export type ActionReferenceRemovedPayload = z.infer<typeof ActionReferenceRemovedPayloadSchema>;

/**
 * Input for adding a reference
 */
export const AddActionReferenceInputSchema = z.object({
  sourceRecordId: z.string().uuid(),
  targetFieldKey: z.string(),
  snapshotValue: z.unknown().optional(),
});
export type AddActionReferenceInput = z.infer<typeof AddActionReferenceInputSchema>;

/**
 * Input for removing a reference
 */
export const RemoveActionReferenceInputSchema = z.object({
  sourceRecordId: z.string().uuid(),
  targetFieldKey: z.string(),
});
export type RemoveActionReferenceInput = z.infer<typeof RemoveActionReferenceInputSchema>;
