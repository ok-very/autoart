/**
 * Import Schemas
 *
 * Zod schemas for import interpretation HTTP routes.
 * Request/response validation for:
 * - POST /api/imports/interpret (single item interpretation)
 * - POST /api/imports/reclassify (re-interpret after user changes)
 * - GET /api/imports/sessions/:id/classifications (fetch classifications)
 */

import { z } from 'zod';

import { ClassificationOutcomeSchema } from './classification.js';

// ============================================================================
// SHARED SUB-SCHEMAS
// ============================================================================

export const FieldRecordingSchema = z.object({
    fieldName: z.string(),
    value: z.unknown(),
    renderHint: z.string().optional(),
});

export const InterpretationOutputSchema = z.object({
    kind: z.enum(['fact_candidate', 'work_event', 'field_value', 'action_hint']),
}).passthrough();

export const InterpretationPlanSchema = z.object({
    outputs: z.array(InterpretationOutputSchema),
    statusEvent: InterpretationOutputSchema.optional(),
    raw: z.object({
        text: z.string(),
        status: z.string().optional(),
        targetDate: z.string().optional(),
        parentTitle: z.string().optional(),
        stageName: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
    }),
});

export const SchemaMatchSchema = z.object({
    definitionId: z.string().nullable(),
    definitionName: z.string().nullable(),
    matchScore: z.number(),
    proposedDefinition: z.object({
        name: z.string(),
        schemaConfig: z.object({
            fields: z.array(z.object({
                key: z.string(),
                type: z.string(),
                label: z.string(),
            })),
        }),
    }).optional(),
    fieldMatches: z.array(z.object({
        recordingFieldName: z.string(),
        recordingRenderHint: z.string().optional(),
        matchedFieldKey: z.string().nullable(),
        matchedFieldLabel: z.string().nullable(),
        matchQuality: z.enum(['exact', 'compatible', 'partial', 'none']),
        score: z.number(),
    })).optional(),
    matchRationale: z.string().optional(),
});

export const ResolutionSchema = z.object({
    resolvedOutcome: ClassificationOutcomeSchema,
    resolvedFactKind: z.string().optional(),
    resolvedPayload: z.record(z.string(), z.unknown()).optional(),
});

export const ItemClassificationSchema = z.object({
    itemTempId: z.string(),
    outcome: ClassificationOutcomeSchema,
    confidence: z.enum(['high', 'medium', 'low']),
    rationale: z.string(),
    candidates: z.array(z.string()).optional(),
    interpretationPlan: InterpretationPlanSchema.optional(),
    resolution: ResolutionSchema.optional(),
    schemaMatch: SchemaMatchSchema.optional(),
});
export type ItemClassificationResponse = z.infer<typeof ItemClassificationSchema>;

// ============================================================================
// POST /api/imports/interpret — Interpret a single item
// ============================================================================

export const InterpretItemRequestSchema = z.object({
    title: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    fieldRecordings: z.array(FieldRecordingSchema).optional(),
    entityType: z.string().optional(),
});
export type InterpretItemRequest = z.infer<typeof InterpretItemRequestSchema>;

export const InterpretItemResponseSchema = z.object({
    classification: ItemClassificationSchema,
});
export type InterpretItemResponse = z.infer<typeof InterpretItemResponseSchema>;

// ============================================================================
// POST /api/imports/reclassify — Re-interpret after user changes
// ============================================================================

export const ReclassifyRequestSchema = z.object({
    sessionId: z.string().uuid(),
    itemTempId: z.string().min(1),
    changes: z.object({
        title: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        fieldRecordings: z.array(FieldRecordingSchema).optional(),
    }),
});
export type ReclassifyRequest = z.infer<typeof ReclassifyRequestSchema>;

export const ReclassifyResponseSchema = z.object({
    classification: ItemClassificationSchema,
});
export type ReclassifyResponse = z.infer<typeof ReclassifyResponseSchema>;

// ============================================================================
// GET /api/imports/sessions/:id/classifications
// ============================================================================

export const ClassificationsResponseSchema = z.object({
    classifications: z.array(ItemClassificationSchema),
    sessionId: z.string().uuid(),
    totalItems: z.number(),
    unresolvedCount: z.number(),
});
export type ClassificationsResponse = z.infer<typeof ClassificationsResponseSchema>;

// ============================================================================
// IMPORT-ACTION LINKS
// ============================================================================

export const LinkActionRequestSchema = z.object({
    sessionId: z.string().uuid(),
    itemTempId: z.string().min(1),
    actionId: z.string().uuid(),
});
export type LinkActionRequest = z.infer<typeof LinkActionRequestSchema>;

export const ImportActionLinkSchema = z.object({
    id: z.string().uuid(),
    importSessionId: z.string().uuid(),
    itemTempId: z.string(),
    actionId: z.string().uuid(),
    createdAt: z.string(),
});
export type ImportActionLink = z.infer<typeof ImportActionLinkSchema>;

export const ActionLinksResponseSchema = z.object({
    links: z.array(ImportActionLinkSchema),
});
export type ActionLinksResponse = z.infer<typeof ActionLinksResponseSchema>;
