import { z } from 'zod';

/**
 * Record Link Schema
 * Represents a many-to-many relationship between records
 */
export const RecordLinkSchema = z.object({
  id: z.string().uuid(),
  source_record_id: z.string().uuid(),
  target_record_id: z.string().uuid(),
  link_type: z.string(),
  metadata: z.record(z.unknown()).default({}),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
});

export type RecordLink = z.infer<typeof RecordLinkSchema>;

/**
 * Create Link Input Schema
 */
export const CreateLinkInputSchema = z.object({
  sourceRecordId: z.string().uuid(),
  targetRecordId: z.string().uuid(),
  linkType: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateLinkInput = z.infer<typeof CreateLinkInputSchema>;

/**
 * API Response Schemas
 */
export const LinkResponseSchema = z.object({
  link: RecordLinkSchema,
});

export const LinksResponseSchema = z.object({
  links: z.array(RecordLinkSchema),
});
