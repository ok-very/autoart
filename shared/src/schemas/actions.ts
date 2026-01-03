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

  // Assignment events
  'ASSIGNMENT_OCCURRED',  // Someone was assigned
  'ASSIGNMENT_REMOVED',   // Assignment was removed
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Field binding - maps action parameters to Field definitions
 */
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
  payload: z.record(z.unknown()).default({}),
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
  payload: z.record(z.unknown()).optional().default({}),
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
  assignee: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).optional(),
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
