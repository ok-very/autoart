/**
 * Domain Event Payloads — 7 Canonical Families
 *
 * These payloads are used with the FACT_RECORDED event type via payload discrimination.
 *
 * Guiding Principle:
 *   Events record externally observable facts, not internal deliberation or intent.
 *
 * 7 Families:
 *   1. Communication (INFORMATION_SENT)
 *   2. Artifacts (DOCUMENT_PREPARED, DOCUMENT_SUBMITTED)
 *   3. Meetings (MEETING_SCHEDULED, MEETING_HELD)
 *   4. Decisions (DECISION_RECORDED)
 *   5. Financial (INVOICE_PREPARED, PAYMENT_RECORDED)
 *   6. Contracts (CONTRACT_EXECUTED)
 *   7. Process (PROCESS_INITIATED, PROCESS_COMPLETED)
 */

import { z } from 'zod';

// ============================================================================
// FACT KIND REGISTRY (12 canonical kinds)
// ============================================================================

export const KnownFactKind = {
    // 1. Communication
    INFORMATION_SENT: 'INFORMATION_SENT',

    // 2. Artifacts
    DOCUMENT_PREPARED: 'DOCUMENT_PREPARED',
    DOCUMENT_SUBMITTED: 'DOCUMENT_SUBMITTED',

    // 3. Meetings
    MEETING_SCHEDULED: 'MEETING_SCHEDULED',
    MEETING_HELD: 'MEETING_HELD',
    MEETING_CANCELLED: 'MEETING_CANCELLED',

    // 4. Decisions
    DECISION_RECORDED: 'DECISION_RECORDED',

    // 5. Financial
    INVOICE_PREPARED: 'INVOICE_PREPARED',
    PAYMENT_RECORDED: 'PAYMENT_RECORDED',

    // 6. Contracts
    CONTRACT_EXECUTED: 'CONTRACT_EXECUTED',

    // 7. Process
    PROCESS_INITIATED: 'PROCESS_INITIATED',
    PROCESS_COMPLETED: 'PROCESS_COMPLETED',
} as const;

export type KnownFactKind = (typeof KnownFactKind)[keyof typeof KnownFactKind];

// ============================================================================
// BASE FACT PAYLOAD
// ============================================================================

export const BaseFactPayloadSchema = z.object({
    factKind: z.string(),
    occurredAt: z.string().datetime().optional(),
    source: z.enum(['manual', 'csv-import', 'system']).optional(),
    confidence: z.enum(['low', 'medium', 'high']).optional(),
    notes: z.string().optional(),
});
export type BaseFactPayload = z.infer<typeof BaseFactPayloadSchema>;

// ============================================================================
// 1. COMMUNICATION FAMILY
// ============================================================================

/**
 * INFORMATION_SENT — Captures requests, submissions, reminders, follow-ups.
 * Whether it's a "request" or "delivery" is semantics; the fact is information was sent.
 */
export const InformationSentPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.INFORMATION_SENT),
    subject: z.string().optional(),
    audiences: z.array(z.string()),
    artifacts: z.array(z.string()).optional(),
    channel: z.string().optional(),
});
export type InformationSentPayload = z.infer<typeof InformationSentPayloadSchema>;

// ============================================================================
// 2. ARTIFACT FAMILY
// ============================================================================

/**
 * DOCUMENT_PREPARED — A persistent artifact was created/drafted.
 */
export const DocumentPreparedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.DOCUMENT_PREPARED),
    documentType: z.string(),
    documentId: z.string().optional(),
});
export type DocumentPreparedPayload = z.infer<typeof DocumentPreparedPayloadSchema>;

/**
 * DOCUMENT_SUBMITTED — An artifact was submitted to an external party.
 */
export const DocumentSubmittedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.DOCUMENT_SUBMITTED),
    documentType: z.string(),
    submittedTo: z.string().optional(),
});
export type DocumentSubmittedPayload = z.infer<typeof DocumentSubmittedPayloadSchema>;

// ============================================================================
// 3. MEETING FAMILY
// ============================================================================

/**
 * MEETING_SCHEDULED — A meeting has been coordinated and scheduled.
 */
export const MeetingScheduledPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.MEETING_SCHEDULED),
    plannedAt: z.string().datetime().optional(),
    participants: z.array(z.string()).optional(),
    location: z.string().optional(),
    meetingLink: z.string().url().optional(),
});
export type MeetingScheduledPayload = z.infer<typeof MeetingScheduledPayloadSchema>;

/**
 * MEETING_HELD — A meeting occurred (externally observable fact).
 */
export const MeetingHeldPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.MEETING_HELD),
    occurredAt: z.string().datetime().optional(),
    participants: z.array(z.string()).optional(),
    outcomeSummary: z.string().optional(),
});
export type MeetingHeldPayload = z.infer<typeof MeetingHeldPayloadSchema>;

/**
 * MEETING_CANCELLED — A scheduled meeting was cancelled.
 */
export const MeetingCancelledPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.MEETING_CANCELLED),
    reason: z.string().optional(),
});
export type MeetingCancelledPayload = z.infer<typeof MeetingCancelledPayloadSchema>;

// ============================================================================
// 4. DECISION FAMILY
// ============================================================================

/**
 * DECISION_RECORDED — A decision that ends ambiguity.
 * Milestones, selections, approvals are all decisions.
 */
export const DecisionRecordedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.DECISION_RECORDED),
    decisionType: z.string(),
    subject: z.string().optional(),
});
export type DecisionRecordedPayload = z.infer<typeof DecisionRecordedPayloadSchema>;

// ============================================================================
// 5. FINANCIAL FAMILY
// ============================================================================

/**
 * INVOICE_PREPARED — An invoice or honorarium was drafted.
 */
export const InvoicePreparedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.INVOICE_PREPARED),
    counterparty: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
});
export type InvoicePreparedPayload = z.infer<typeof InvoicePreparedPayloadSchema>;

/**
 * PAYMENT_RECORDED — A payment was received or made.
 */
export const PaymentRecordedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.PAYMENT_RECORDED),
    counterparty: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
});
export type PaymentRecordedPayload = z.infer<typeof PaymentRecordedPayloadSchema>;

// ============================================================================
// 6. CONTRACT FAMILY
// ============================================================================

/**
 * CONTRACT_EXECUTED — A contract was fully executed (legally binding).
 * Execution is the legally meaningful boundary; partial signatures are not facts.
 */
export const ContractExecutedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.CONTRACT_EXECUTED),
    parties: z.array(z.string()),
    executedAt: z.string().datetime().optional(),
    contractType: z.string().optional(),
});
export type ContractExecutedPayload = z.infer<typeof ContractExecutedPayloadSchema>;

// ============================================================================
// 7. PROCESS FAMILY
// ============================================================================

/**
 * PROCESS_INITIATED — A process/project has started.
 */
export const ProcessInitiatedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.PROCESS_INITIATED),
    processName: z.string().optional(),
});
export type ProcessInitiatedPayload = z.infer<typeof ProcessInitiatedPayloadSchema>;

/**
 * PROCESS_COMPLETED — A process/project has finished.
 */
export const ProcessCompletedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.PROCESS_COMPLETED),
    processName: z.string().optional(),
});
export type ProcessCompletedPayload = z.infer<typeof ProcessCompletedPayloadSchema>;

// ============================================================================
// FACT PAYLOAD REGISTRY
// ============================================================================

export const FactPayloadSchemas: Record<string, z.ZodType> = {
    [KnownFactKind.INFORMATION_SENT]: InformationSentPayloadSchema,
    [KnownFactKind.DOCUMENT_PREPARED]: DocumentPreparedPayloadSchema,
    [KnownFactKind.DOCUMENT_SUBMITTED]: DocumentSubmittedPayloadSchema,
    [KnownFactKind.MEETING_SCHEDULED]: MeetingScheduledPayloadSchema,
    [KnownFactKind.MEETING_HELD]: MeetingHeldPayloadSchema,
    [KnownFactKind.MEETING_CANCELLED]: MeetingCancelledPayloadSchema,
    [KnownFactKind.DECISION_RECORDED]: DecisionRecordedPayloadSchema,
    [KnownFactKind.INVOICE_PREPARED]: InvoicePreparedPayloadSchema,
    [KnownFactKind.PAYMENT_RECORDED]: PaymentRecordedPayloadSchema,
    [KnownFactKind.CONTRACT_EXECUTED]: ContractExecutedPayloadSchema,
    [KnownFactKind.PROCESS_INITIATED]: ProcessInitiatedPayloadSchema,
    [KnownFactKind.PROCESS_COMPLETED]: ProcessCompletedPayloadSchema,
};

export const FactRecordedPayloadSchema = BaseFactPayloadSchema;
export type FactRecordedPayload = z.infer<typeof FactRecordedPayloadSchema>;

export function validateFactPayload(payload: unknown): boolean {
    const base = BaseFactPayloadSchema.parse(payload);
    const specificSchema = FactPayloadSchemas[base.factKind];
    if (specificSchema) {
        specificSchema.parse(payload);
    }
    return true;
}
