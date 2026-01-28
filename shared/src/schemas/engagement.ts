/**
 * Engagement Event Payloads
 *
 * General-purpose engagement tracking schema for recording user interactions
 * with forms, polls, and pages. Follows the domain-events.ts pattern with
 * kind registry and discriminated payloads.
 *
 * 3 Engagement Kinds:
 *   1. OPENED - User loaded the page/form
 *   2. INTERACTED - User made input (typed, clicked, selected)
 *   3. DEFFER - User left without completing (implicit "maybe")
 */

import { z } from 'zod';

// ============================================================================
// ENGAGEMENT KIND REGISTRY
// ============================================================================

export const EngagementKind = {
  OPENED: 'OPENED',
  INTERACTED: 'INTERACTED',
  DEFFER: 'DEFFER',
} as const;

export type EngagementKind = (typeof EngagementKind)[keyof typeof EngagementKind];

export const EngagementKindSchema = z.enum([
  EngagementKind.OPENED,
  EngagementKind.INTERACTED,
  EngagementKind.DEFFER,
]);

// ============================================================================
// ENGAGEMENT CONTEXT TYPES
// ============================================================================

export const EngagementContextType = {
  POLL: 'poll',
  FORM: 'form',
  PAGE: 'page',
} as const;

export type EngagementContextType = (typeof EngagementContextType)[keyof typeof EngagementContextType];

export const EngagementContextTypeSchema = z.enum([
  EngagementContextType.POLL,
  EngagementContextType.FORM,
  EngagementContextType.PAGE,
]);

// ============================================================================
// BASE ENGAGEMENT PAYLOAD
// ============================================================================

export const BaseEngagementPayloadSchema = z.object({
  kind: EngagementKindSchema,
  contextType: EngagementContextTypeSchema,
  contextId: z.string(),
  actorName: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
});
export type BaseEngagementPayload = z.infer<typeof BaseEngagementPayloadSchema>;

// ============================================================================
// SPECIFIC ENGAGEMENT PAYLOADS
// ============================================================================

export const OpenedEngagementSchema = BaseEngagementPayloadSchema.extend({
  kind: z.literal(EngagementKind.OPENED),
});
export type OpenedEngagement = z.infer<typeof OpenedEngagementSchema>;

export const InteractedEngagementSchema = BaseEngagementPayloadSchema.extend({
  kind: z.literal(EngagementKind.INTERACTED),
  interactionType: z.string().optional(),
});
export type InteractedEngagement = z.infer<typeof InteractedEngagementSchema>;

export const DefferEngagementSchema = BaseEngagementPayloadSchema.extend({
  kind: z.literal(EngagementKind.DEFFER),
  progress: z.record(z.string(), z.unknown()).optional(),
});
export type DefferEngagement = z.infer<typeof DefferEngagementSchema>;

// ============================================================================
// ENGAGEMENT PAYLOAD UNION
// ============================================================================

export const EngagementPayloadSchema = z.discriminatedUnion('kind', [
  OpenedEngagementSchema,
  InteractedEngagementSchema,
  DefferEngagementSchema,
]);
export type EngagementPayload = z.infer<typeof EngagementPayloadSchema>;

// ============================================================================
// API INPUT SCHEMA
// ============================================================================

export const LogEngagementInputSchema = z.object({
  kind: EngagementKindSchema,
  actorName: z.string().optional(),
  interactionType: z.string().optional(),
  progress: z.record(z.string(), z.unknown()).optional(),
});
export type LogEngagementInput = z.infer<typeof LogEngagementInputSchema>;

// ============================================================================
// RENDER FUNCTION
// ============================================================================

export function renderEngagement(payload: BaseEngagementPayload): string {
  const { kind, contextType, actorName } = payload;
  const actor = actorName ? ` by ${actorName}` : '';

  switch (kind) {
    case EngagementKind.OPENED:
      return `${contextType} opened${actor}`;
    case EngagementKind.INTERACTED:
      return `${contextType} interaction${actor}`;
    case EngagementKind.DEFFER:
      return `${contextType} deferred${actor}`;
    default:
      return `Engagement: ${kind}`;
  }
}
