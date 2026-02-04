/**
 * Poll Schemas
 *
 * Defines schemas for availability polling system.
 * Used for gathering participant availability across time slots.
 */

import { z } from 'zod';

// ==================== ENUMS ====================

export const PollStatusSchema = z.enum(['active', 'closed', 'draft']);
export type PollStatus = z.infer<typeof PollStatusSchema>;

export const TimeSlotGranularitySchema = z.enum(['15min', '30min', '60min']);
export type TimeSlotGranularity = z.infer<typeof TimeSlotGranularitySchema>;

// ==================== TIME CONFIG ====================

/**
 * Time configuration for a poll - which dates/hours to poll.
 */
export const PollTimeConfigSchema = z.object({
  dates: z.array(z.string()), // ["2024-02-01", "2024-02-02"]
  start_hour: z.number().int().min(0).max(23),
  end_hour: z.number().int().min(0).max(23),
  granularity: TimeSlotGranularitySchema.default('30min'),
  timezone: z.string().default('America/Vancouver'),
});
export type PollTimeConfig = z.infer<typeof PollTimeConfigSchema>;

// ==================== POLL ENTITY ====================

/**
 * Poll entity - the parent entity for an availability poll.
 */
export const PollSchema = z.object({
  id: z.string().uuid(),
  unique_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  confirmation_message: z.string().nullable(), // Custom message shown after response submission
  status: PollStatusSchema,
  time_config: PollTimeConfigSchema,
  project_id: z.string().uuid().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable(),
});
export type Poll = z.infer<typeof PollSchema>;

// ==================== RESPONSE ENTITY ====================

/**
 * Poll participant response - a participant's availability submission.
 */
export const PollParticipantResponseSchema = z.object({
  id: z.string().uuid(),
  poll_id: z.string().uuid(),
  participant_name: z.string(),
  participant_email: z.string().email().nullable(),
  available_slots: z.array(z.string()), // ["2024-02-01:09:00", "2024-02-01:09:30"]
  user_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type PollParticipantResponse = z.infer<typeof PollParticipantResponseSchema>;

// ==================== AGGREGATED RESULTS ====================

/**
 * Slot availability - aggregated availability for a single time slot.
 */
export const SlotAvailabilitySchema = z.object({
  slot_key: z.string(),
  count: z.number(),
  participants: z.array(z.string()),
});
export type SlotAvailability = z.infer<typeof SlotAvailabilitySchema>;

/**
 * Poll results - aggregated results for a poll.
 */
export const PollResultsSchema = z.object({
  poll_id: z.string().uuid(),
  total_responses: z.number(),
  slots: z.array(SlotAvailabilitySchema),
  best_slots: z.array(z.string()),
});
export type PollResults = z.infer<typeof PollResultsSchema>;

// ==================== API INPUT SCHEMAS ====================

/**
 * Create poll input
 */
export const CreatePollInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  time_config: PollTimeConfigSchema,
  project_id: z.string().uuid().optional(),
});
export type CreatePollInput = z.infer<typeof CreatePollInputSchema>;

/**
 * Update poll input
 */
export const UpdatePollInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  confirmation_message: z.string().max(500).nullish(),
  time_config: PollTimeConfigSchema.optional(),
  status: z.enum(['active', 'draft']).optional(), // Can't un-close
});
export type UpdatePollInput = z.infer<typeof UpdatePollInputSchema>;

/**
 * Duplicate poll input
 */
export const DuplicatePollInputSchema = z.object({
  title: z.string().min(1).max(200).optional(), // Defaults to "{original} (copy)"
});
export type DuplicatePollInput = z.infer<typeof DuplicatePollInputSchema>;

/**
 * Submit poll response input
 */
export const SubmitPollResponseInputSchema = z.object({
  participant_name: z.string().min(1).max(100),
  participant_email: z.string().email().optional(),
  available_slots: z.array(z.string()),
});
export type SubmitPollResponseInput = z.infer<typeof SubmitPollResponseInputSchema>;

// ==================== API RESPONSE SCHEMAS ====================

export const PollResponseSchema = z.object({
  poll: PollSchema,
});
export type PollResponse = z.infer<typeof PollResponseSchema>;

export const PollsResponseSchema = z.object({
  polls: z.array(PollSchema),
});
export type PollsResponse = z.infer<typeof PollsResponseSchema>;

export const PollResultsResponseSchema = z.object({
  results: PollResultsSchema,
});
export type PollResultsResponse = z.infer<typeof PollResultsResponseSchema>;

export const PollParticipantResponsesResponseSchema = z.object({
  responses: z.array(PollParticipantResponseSchema),
});
export type PollParticipantResponsesResponse = z.infer<typeof PollParticipantResponsesResponseSchema>;
