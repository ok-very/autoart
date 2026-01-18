/**
 * Mail Module - Zod Schemas
 */

import { z } from 'zod';

export const TriageStatusSchema = z.enum([
    'pending',
    'action_required',
    'approval_needed',
    'fyi',
    'delegated',
    'archived',
]);

export type TriageStatus = z.infer<typeof TriageStatusSchema>;

export const AttachmentSchema = z.object({
    id: z.string(),
    name: z.string(),
    filename: z.string(),
    contentType: z.string(),
    localPath: z.string().optional(),
    size: z.number(),
    type: z.string(),
    url: z.string(),
});

export const TriageSchema = z.object({
    bucket: z.string(),
    confidence: z.number(),
    reasoning: z.array(z.string()),
    preReplyActions: z.array(z.object({ description: z.string(), type: z.string() })),
    postReplyActions: z.array(z.object({ description: z.string(), type: z.string() })),
    suggestedReplyOpener: z.string().optional(),
});

export const EmailSchema = z.object({
    id: z.string(),
    subject: z.string(),
    from: z.string(),
    fromName: z.string(),
    receivedDateTime: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    constructionPhase: z.string().optional(),
    stakeholderType: z.string(),
    priority: z.number(),
    hasAttachments: z.boolean(),
    attachments: z.array(AttachmentSchema),
    bodyPreview: z.string(),
    cc: z.string().nullable(),
    developer: z.string(),
    priorityFactors: z.array(z.any()),
    triage: TriageSchema.optional(),
    extractedKeywords: z.array(z.string()),
    metadata: z.object({
        triage_status: TriageStatusSchema.optional(),
        notes: z.string().optional(),
    }).optional(),
});

export type Email = z.infer<typeof EmailSchema>;

export const UpdateTriageBodySchema = z.object({
    status: TriageStatusSchema,
    notes: z.string().optional(),
});

export type UpdateTriageBody = z.infer<typeof UpdateTriageBodySchema>;

export const ListEmailsResponseSchema = z.object({
    emails: z.array(EmailSchema),
    total: z.number(),
});

export const EmailParamsSchema = z.object({
    id: z.string(),
});
