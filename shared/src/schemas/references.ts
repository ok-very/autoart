import { z } from 'zod';
import { RefModeSchema, ReferenceStatusSchema } from './enums';

// ============================================================================
// ACTION REFERENCES (Foundational Model)
// Links Actions to Records - the new canonical model
// ============================================================================

/**
 * Action Reference Schema
 * Links an action to a record field with static/dynamic mode
 */
export const ActionReferenceSchema = z.object({
  id: z.string().uuid(),
  actionId: z.string().uuid(),
  sourceRecordId: z.string().uuid().nullable(),
  targetFieldKey: z.string().nullable(),
  mode: RefModeSchema,
  snapshotValue: z.unknown().nullable(),
  createdAt: z.coerce.date(),
  legacyTaskReferenceId: z.string().uuid().nullable().optional(),
});

export type ActionReference = z.infer<typeof ActionReferenceSchema>;

/**
 * Create Action Reference Input Schema
 */
export const CreateActionReferenceInputSchema = z.object({
  actionId: z.string().uuid(),
  sourceRecordId: z.string().uuid(),
  targetFieldKey: z.string(),
  mode: RefModeSchema.optional().default('dynamic'),
});

export type CreateActionReferenceInput = z.infer<typeof CreateActionReferenceInputSchema>;

// ============================================================================
// TASK REFERENCES (DEPRECATED)
// Read-only after migration 022. Use ActionReference instead.
// ============================================================================

/**
 * Task Reference Schema
 * @deprecated Use ActionReferenceSchema instead. TaskReferences are read-only after migration 022.
 */
export const TaskReferenceSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  source_record_id: z.string().uuid().nullable(),
  target_field_key: z.string().nullable(),
  mode: RefModeSchema,
  snapshot_value: z.unknown().nullable(),
  created_at: z.string().datetime(),
});

/** @deprecated Use ActionReference instead */
export type TaskReference = z.infer<typeof TaskReferenceSchema>;

/**
 * Create Reference Input Schema
 * @deprecated Use CreateActionReferenceInputSchema instead
 */
export const CreateReferenceInputSchema = z.object({
  taskId: z.string().uuid(),
  sourceRecordId: z.string().uuid(),
  targetFieldKey: z.string(),
  mode: RefModeSchema.optional().default('dynamic'),
});

/** @deprecated Use CreateActionReferenceInput instead */
export type CreateReferenceInput = z.infer<typeof CreateReferenceInputSchema>;

// ============================================================================
// SHARED RESOLUTION TYPES
// ============================================================================

/**
 * Resolved Reference Schema
 * A reference with its current resolved value and status
 */
export const ResolvedReferenceSchema = z.object({
  referenceId: z.string().uuid(),
  /** Current resolution status - the authoritative state */
  status: ReferenceStatusSchema,
  /** The resolved value (if status is dynamic or static) */
  value: z.unknown(),
  /** Human-readable label for display */
  label: z.string(),
  /** Source record ID (if resolvable) */
  sourceRecordId: z.string().uuid().nullable(),
  /** Target field key (if resolvable) */
  targetFieldKey: z.string().nullable(),
  /**
   * @deprecated Use status instead. Kept for backward compatibility.
   * True if static snapshot differs from live value.
   */
  drift: z.boolean().optional(),
  /**
   * The live value from source (for drift detection in static mode)
   * Only populated when status is 'static' and drift detection is needed
   */
  liveValue: z.unknown().optional(),
  /** Human-readable reason for the current status */
  reason: z.string().optional(),
});

export type ResolvedReference = z.infer<typeof ResolvedReferenceSchema>;

/**
 * Update Reference Mode Input Schema
 */
export const UpdateReferenceModeInputSchema = z.object({
  mode: RefModeSchema,
});

export type UpdateReferenceModeInput = z.infer<typeof UpdateReferenceModeInputSchema>;

/**
 * Update Reference Snapshot Input Schema
 */
export const UpdateReferenceSnapshotInputSchema = z.object({
  value: z.unknown(),
});

export type UpdateReferenceSnapshotInput = z.infer<typeof UpdateReferenceSnapshotInputSchema>;

/**
 * Bulk Resolve Input Schema
 */
export const BulkResolveInputSchema = z.object({
  referenceIds: z.array(z.string().uuid()),
});

export type BulkResolveInput = z.infer<typeof BulkResolveInputSchema>;

/**
 * API Response Schemas
 */
export const ActionReferenceResponseSchema = z.object({
  reference: ActionReferenceSchema,
});

export const ActionReferencesResponseSchema = z.object({
  references: z.array(ActionReferenceSchema),
});

/** @deprecated Use ActionReferenceResponseSchema */
export const ReferenceResponseSchema = z.object({
  reference: TaskReferenceSchema,
});

/** @deprecated Use ActionReferencesResponseSchema */
export const ReferencesResponseSchema = z.object({
  references: z.array(TaskReferenceSchema),
});

export const ResolvedReferenceResponseSchema = z.object({
  resolved: ResolvedReferenceSchema,
});

export const DriftCheckResponseSchema = z.object({
  drift: z.boolean(),
  liveValue: z.unknown(),
  snapshotValue: z.unknown(),
});
