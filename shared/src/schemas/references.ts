import { z } from 'zod';
import { RefModeSchema } from './enums';

/**
 * Task Reference Schema
 * Links a task to a record field with static/dynamic mode
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

export type TaskReference = z.infer<typeof TaskReferenceSchema>;

/**
 * Resolved Reference Schema
 * A reference with its current resolved value and drift status
 */
export const ResolvedReferenceSchema = z.object({
  referenceId: z.string().uuid(),
  mode: RefModeSchema,
  value: z.unknown(),
  drift: z.boolean(),
  liveValue: z.unknown().optional(),
  sourceRecordId: z.string().uuid().nullable(),
  targetFieldKey: z.string().nullable(),
  label: z.string(),
});

export type ResolvedReference = z.infer<typeof ResolvedReferenceSchema>;

/**
 * Create Reference Input Schema
 */
export const CreateReferenceInputSchema = z.object({
  taskId: z.string().uuid(),
  sourceRecordId: z.string().uuid(),
  targetFieldKey: z.string(),
  mode: RefModeSchema.optional().default('dynamic'),
});

export type CreateReferenceInput = z.infer<typeof CreateReferenceInputSchema>;

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
export const ReferenceResponseSchema = z.object({
  reference: TaskReferenceSchema,
});

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
