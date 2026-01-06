/**
 * Domain Event Payloads
 *
 * This module defines payload schemas for domain-specific events.
 * These are used with the FACT_RECORDED event type via payload discrimination.
 *
 * Design decision: Domain facts live in payload space, not event type enum space.
 * This allows:
 * - Schema-driven extensibility without enum churn
 * - Agents to introduce new facts safely
 * - UI and projections to evolve independently
 *
 * Usage:
 *   emitEvent({
 *     type: 'FACT_RECORDED',
 *     payload: { factKind: 'MEETING_HELD', ...meetingPayload }
 *   })
 */

import { z } from 'zod';

// ============================================================================
// FACT KIND REGISTRY
// ============================================================================

/**
 * Known fact kinds. This is extensible - unknown kinds are allowed but may
 * be flagged for review when auto-created during CSV import.
 */
export const KnownFactKind = {
    // Meeting events
    MEETING_SCHEDULED: 'MEETING_SCHEDULED',
    AGENDA_PREPARED: 'AGENDA_PREPARED',
    MATERIALS_SENT: 'MATERIALS_SENT',
    REMINDER_SENT: 'REMINDER_SENT',
    MEETING_HELD: 'MEETING_HELD',
    MEETING_CANCELLED: 'MEETING_CANCELLED',
    MEETING_RESCHEDULED: 'MEETING_RESCHEDULED',
    FOLLOWED_UP: 'FOLLOWED_UP',

    // Contract events
    CONTRACT_DRAFTED: 'CONTRACT_DRAFTED',
    CONTRACT_SENT: 'CONTRACT_SENT',
    SIGNATURE_REQUESTED: 'SIGNATURE_REQUESTED',
    SIGNATURE_RECEIVED: 'SIGNATURE_RECEIVED',
    CONTRACT_EXECUTED: 'CONTRACT_EXECUTED',
    CONTRACT_AMENDED: 'CONTRACT_AMENDED',

    // Document events
    DOCUMENT_FILED: 'DOCUMENT_FILED',
    DOCUMENT_SUBMITTED: 'DOCUMENT_SUBMITTED',
    DOCUMENT_APPROVED: 'DOCUMENT_APPROVED',

    // Invoice events
    INVOICE_DRAFTED: 'INVOICE_DRAFTED',
    INVOICE_REVISED: 'INVOICE_REVISED',
    INVOICE_SUBMITTED: 'INVOICE_SUBMITTED',
    INVOICE_REJECTED: 'INVOICE_REJECTED',
    PAYMENT_RECORDED: 'PAYMENT_RECORDED',

    // Process events
    PROCESS_INITIATED: 'PROCESS_INITIATED',
    PROCESS_COMPLETED: 'PROCESS_COMPLETED',
    STAGE_INITIATED: 'STAGE_INITIATED',
    STAGE_COMPLETED: 'STAGE_COMPLETED',
} as const;

export type KnownFactKind = (typeof KnownFactKind)[keyof typeof KnownFactKind];

// ============================================================================
// BASE FACT PAYLOAD
// ============================================================================

/**
 * Base payload for all FACT_RECORDED events.
 * All domain facts extend this with their specific fields.
 */
export const BaseFactPayloadSchema = z.object({
    factKind: z.string(), // Discriminator - can be any string, known kinds are validated
    occurredAt: z.string().datetime().optional(), // When the fact occurred (may differ from event timestamp)
    source: z.enum(['manual', 'csv-import', 'system']).optional(),
    confidence: z.enum(['low', 'medium', 'high']).optional(),
    notes: z.string().optional(),
});
export type BaseFactPayload = z.infer<typeof BaseFactPayloadSchema>;

// ============================================================================
// MEETING EVENT PAYLOADS
// ============================================================================

export const MeetingScheduledPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.MEETING_SCHEDULED),
    plannedAt: z.string().datetime(),
    meetingLink: z.string().url().optional(),
    location: z.string().optional(),
    attendees: z.array(z.string()).optional(),
});
export type MeetingScheduledPayload = z.infer<typeof MeetingScheduledPayloadSchema>;

export const AgendaPreparedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.AGENDA_PREPARED),
    agendaDocId: z.string().optional(),
    agendaItems: z.array(z.string()).optional(),
});
export type AgendaPreparedPayload = z.infer<typeof AgendaPreparedPayloadSchema>;

export const MaterialsSentPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.MATERIALS_SENT),
    audiences: z.array(z.string()).optional(),
    materials: z.array(z.string()).optional(),
    channel: z.string().optional(), // "email", "upload", "sharepoint"
});
export type MaterialsSentPayload = z.infer<typeof MaterialsSentPayloadSchema>;

export const ReminderSentPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.REMINDER_SENT),
    audience: z.array(z.string()).optional(),
    messageType: z.string().optional(), // "meeting reminder", "follow-up"
});
export type ReminderSentPayload = z.infer<typeof ReminderSentPayloadSchema>;

export const MeetingHeldPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.MEETING_HELD),
    attendance: z.array(z.string()).optional(),
    minutesDocId: z.string().optional(),
    outcomeSummary: z.string().optional(),
});
export type MeetingHeldPayload = z.infer<typeof MeetingHeldPayloadSchema>;

export const FollowedUpPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.FOLLOWED_UP),
    channel: z.string().optional(),
    recipients: z.array(z.string()).optional(),
});
export type FollowedUpPayload = z.infer<typeof FollowedUpPayloadSchema>;

// ============================================================================
// CONTRACT EVENT PAYLOADS
// ============================================================================

export const ContractSentPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.CONTRACT_SENT),
    contractDocId: z.string().optional(),
    recipients: z.array(z.string()).optional(),
    sentVia: z.string().optional(), // "docusign", "email"
});
export type ContractSentPayload = z.infer<typeof ContractSentPayloadSchema>;

export const SignatureReceivedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.SIGNATURE_RECEIVED),
    signatory: z.string().optional(),
    signedDocId: z.string().optional(),
});
export type SignatureReceivedPayload = z.infer<typeof SignatureReceivedPayloadSchema>;

export const ContractExecutedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.CONTRACT_EXECUTED),
    executedDocId: z.string().optional(),
    allParties: z.array(z.string()).optional(),
});
export type ContractExecutedPayload = z.infer<typeof ContractExecutedPayloadSchema>;

// ============================================================================
// INVOICE EVENT PAYLOADS
// ============================================================================

export const InvoiceDraftedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.INVOICE_DRAFTED),
    amount: z.number().optional(),
    invoiceNumber: z.string().optional(),
});
export type InvoiceDraftedPayload = z.infer<typeof InvoiceDraftedPayloadSchema>;

export const InvoiceSubmittedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.INVOICE_SUBMITTED),
    submittedTo: z.string().optional(),
    amount: z.number().optional(),
});
export type InvoiceSubmittedPayload = z.infer<typeof InvoiceSubmittedPayloadSchema>;

export const PaymentRecordedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.PAYMENT_RECORDED),
    amount: z.number().optional(),
    paymentMethod: z.string().optional(),
});
export type PaymentRecordedPayload = z.infer<typeof PaymentRecordedPayloadSchema>;

// ============================================================================
// PROCESS EVENT PAYLOADS
// ============================================================================

export const StageInitiatedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.STAGE_INITIATED),
    stageName: z.string().optional(),
    stageNumber: z.number().optional(),
});
export type StageInitiatedPayload = z.infer<typeof StageInitiatedPayloadSchema>;

export const StageCompletedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.STAGE_COMPLETED),
    stageName: z.string().optional(),
    stageNumber: z.number().optional(),
});
export type StageCompletedPayload = z.infer<typeof StageCompletedPayloadSchema>;

// ============================================================================
// FACT PAYLOAD REGISTRY
// ============================================================================

/**
 * Registry of known fact payload schemas, keyed by factKind.
 * Used for validation when emitting FACT_RECORDED events.
 */
export const FactPayloadSchemas: Record<string, z.ZodType> = {
    [KnownFactKind.MEETING_SCHEDULED]: MeetingScheduledPayloadSchema,
    [KnownFactKind.AGENDA_PREPARED]: AgendaPreparedPayloadSchema,
    [KnownFactKind.MATERIALS_SENT]: MaterialsSentPayloadSchema,
    [KnownFactKind.REMINDER_SENT]: ReminderSentPayloadSchema,
    [KnownFactKind.MEETING_HELD]: MeetingHeldPayloadSchema,
    [KnownFactKind.FOLLOWED_UP]: FollowedUpPayloadSchema,
    [KnownFactKind.CONTRACT_SENT]: ContractSentPayloadSchema,
    [KnownFactKind.SIGNATURE_RECEIVED]: SignatureReceivedPayloadSchema,
    [KnownFactKind.CONTRACT_EXECUTED]: ContractExecutedPayloadSchema,
    [KnownFactKind.INVOICE_DRAFTED]: InvoiceDraftedPayloadSchema,
    [KnownFactKind.INVOICE_SUBMITTED]: InvoiceSubmittedPayloadSchema,
    [KnownFactKind.PAYMENT_RECORDED]: PaymentRecordedPayloadSchema,
    [KnownFactKind.STAGE_INITIATED]: StageInitiatedPayloadSchema,
    [KnownFactKind.STAGE_COMPLETED]: StageCompletedPayloadSchema,
};

/**
 * Generic FACT_RECORDED payload schema.
 * Validates base structure; specific factKind payloads validated separately.
 */
export const FactRecordedPayloadSchema = BaseFactPayloadSchema;
export type FactRecordedPayload = z.infer<typeof FactRecordedPayloadSchema>;

/**
 * Validate a fact payload against its specific schema if known.
 * Returns true if valid, throws ZodError if invalid.
 */
export function validateFactPayload(payload: unknown): boolean {
    const base = BaseFactPayloadSchema.parse(payload);
    const specificSchema = FactPayloadSchemas[base.factKind];
    if (specificSchema) {
        specificSchema.parse(payload);
    }
    return true;
}
