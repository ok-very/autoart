import { z } from 'zod';

export const refModeSchema = z.enum(['static', 'dynamic']);

export const createReferenceSchema = z.object({
  taskId: z.string().uuid(),
  sourceRecordId: z.string().uuid(),
  targetFieldKey: z.string().min(1),
  mode: refModeSchema.default('dynamic'),
});

export const updateReferenceModeSchema = z.object({
  mode: refModeSchema,
});

export const batchResolveSchema = z.object({
  referenceIds: z.array(z.string().uuid()).min(1).max(100),
});

export type CreateReferenceInput = z.infer<typeof createReferenceSchema>;
export type UpdateReferenceModeInput = z.infer<typeof updateReferenceModeSchema>;
export type BatchResolveInput = z.infer<typeof batchResolveSchema>;
