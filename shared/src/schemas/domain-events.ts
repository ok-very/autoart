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
 *
 * ---------------------------------------------------------------------------
 * Conventions: Email-derived facts (AutoMail)
 * ---------------------------------------------------------------------------
 *
 * AutoMail is a local-first email ingestion + classification tool that can emit
 * fact payloads into the AutoArt event stream.
 *
 * The key design choice is that AutoMail facts are treated as "manual" when a
 * user (or a user-configured auto-approve include/exclude rule) approves them.
 * This preserves the semantics that these facts represent user-authorized
 * workstation-level actions.
 *
 * Recommended conventions (non-breaking; compatible with existing schemas):
 * - source:
 *   - Use `source: "manual"` for AutoMail facts, including auto-approved facts.
 * - confidence:
 *   - `high` for user-approved or rule-auto-approved facts.
 *   - `medium` / `low` for model-only suggestions not explicitly approved.
 * - INFORMATION_SENT for email:
 *   - Set `channel: "email"`.
 *   - Use `artifacts` as URI strings to reference source messages + local files.
 *     Examples:
 *       - "email://<message-id>" (stable message identifier)
 *       - "file://C:/Users/Alex/OneDrive/.../invoice.pdf" (local file reference)
 *       - "onedrive://..." (optional, if you have a stable OneDrive URI)
 * - notes:
 *   - Record audit breadcrumbs like `autoApprovedByRule=<ruleName>` to explain
 *     why a fact was emitted without introducing new schema fields.
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
    BUDGET_ALLOCATED: 'BUDGET_ALLOCATED',
    EXPENSE_RECORDED: 'EXPENSE_RECORDED',
    BILL_RECEIVED: 'BILL_RECEIVED',

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

/**
 * BUDGET_ALLOCATED — A budget allocation was created or updated.
 */
export const BudgetAllocatedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.BUDGET_ALLOCATED),
    budgetName: z.string().optional(),
    allocationType: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
});
export type BudgetAllocatedPayload = z.infer<typeof BudgetAllocatedPayloadSchema>;

/**
 * EXPENSE_RECORDED — An expense was recorded against a budget.
 */
export const ExpenseRecordedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.EXPENSE_RECORDED),
    description: z.string().optional(),
    category: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
});
export type ExpenseRecordedPayload = z.infer<typeof ExpenseRecordedPayloadSchema>;

/**
 * BILL_RECEIVED — A vendor bill was received.
 */
export const BillReceivedPayloadSchema = BaseFactPayloadSchema.extend({
    factKind: z.literal(KnownFactKind.BILL_RECEIVED),
    vendor: z.string().optional(),
    billNumber: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
});
export type BillReceivedPayload = z.infer<typeof BillReceivedPayloadSchema>;

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
    [KnownFactKind.BUDGET_ALLOCATED]: BudgetAllocatedPayloadSchema,
    [KnownFactKind.EXPENSE_RECORDED]: ExpenseRecordedPayloadSchema,
    [KnownFactKind.BILL_RECEIVED]: BillReceivedPayloadSchema,
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

// ============================================================================
// NARRATIVE RENDERING
// ============================================================================

/**
 * Render a fact payload as a human-readable narrative line.
 * Used by the Execution Log to display FACT_RECORDED events.
 *
 * Examples:
 *   INFORMATION_SENT → "Information sent to Developer, Selection Panel"
 *   DOCUMENT_PREPARED → "Agenda prepared"
 *   MEETING_HELD → "Meeting held"
 *   DECISION_RECORDED → "Decision recorded: Artist selected"
 */
export function renderFact(payload: BaseFactPayload): string {
    const { factKind, ...rest } = payload;

    switch (factKind) {
        // Communication
        case KnownFactKind.INFORMATION_SENT: {
            const p = rest as { subject?: string; audiences?: string[]; artifacts?: string[] };
            const subject = p.subject || 'Information';
            const audiences = p.audiences?.join(', ') || '';
            return audiences ? `${subject} sent to ${audiences}` : `${subject} sent`;
        }

        // Artifacts
        case KnownFactKind.DOCUMENT_PREPARED: {
            const p = rest as { documentType?: string };
            const docType = formatDocumentType(p.documentType);
            return `${docType} prepared`;
        }
        case KnownFactKind.DOCUMENT_SUBMITTED: {
            const p = rest as { documentType?: string; submittedTo?: string };
            const docType = formatDocumentType(p.documentType);
            return p.submittedTo ? `${docType} submitted to ${p.submittedTo}` : `${docType} submitted`;
        }

        // Meetings
        case KnownFactKind.MEETING_SCHEDULED: {
            const p = rest as { participants?: string[] };
            const who = p.participants?.length ? ` with ${p.participants.join(', ')}` : '';
            return `Meeting scheduled${who}`;
        }
        case KnownFactKind.MEETING_HELD: {
            const p = rest as { participants?: string[] };
            const who = p.participants?.length ? ` with ${p.participants.join(', ')}` : '';
            return `Meeting held${who}`;
        }
        case KnownFactKind.MEETING_CANCELLED:
            return 'Meeting cancelled';

        // Decisions
        case KnownFactKind.DECISION_RECORDED: {
            const p = rest as { decisionType?: string; subject?: string };
            const type = formatDecisionType(p.decisionType);
            return p.subject ? `${type}: ${p.subject}` : type;
        }

        // Financial
        case KnownFactKind.INVOICE_PREPARED: {
            const p = rest as { counterparty?: string };
            return p.counterparty ? `Invoice prepared for ${p.counterparty}` : 'Invoice prepared';
        }
        case KnownFactKind.PAYMENT_RECORDED: {
            const p = rest as { counterparty?: string };
            return p.counterparty ? `Payment recorded from ${p.counterparty}` : 'Payment recorded';
        }
        case KnownFactKind.BUDGET_ALLOCATED: {
            const p = rest as { budgetName?: string; allocationType?: string };
            const name = p.budgetName || p.allocationType || 'Budget';
            return `${name} allocated`;
        }
        case KnownFactKind.EXPENSE_RECORDED: {
            const p = rest as { description?: string; category?: string };
            const desc = p.description || p.category || 'Expense';
            return `${desc} recorded`;
        }
        case KnownFactKind.BILL_RECEIVED: {
            const p = rest as { vendor?: string; billNumber?: string };
            const id = p.billNumber ? ` #${p.billNumber}` : '';
            return p.vendor ? `Bill${id} received from ${p.vendor}` : `Bill${id} received`;
        }

        // Contracts
        case KnownFactKind.CONTRACT_EXECUTED: {
            const p = rest as { parties?: string[]; contractType?: string };
            const type = p.contractType ? ` (${p.contractType})` : '';
            return `Contract executed${type}`;
        }

        // Process
        case KnownFactKind.PROCESS_INITIATED: {
            const p = rest as { processName?: string };
            return p.processName ? `${p.processName} initiated` : 'Process initiated';
        }
        case KnownFactKind.PROCESS_COMPLETED: {
            const p = rest as { processName?: string };
            return p.processName ? `${p.processName} completed` : 'Process completed';
        }

        // Unknown fact kind
        default:
            return `Fact recorded: ${factKind}`;
    }
}

/**
 * Format document type for display (e.g., "agenda" → "Agenda")
 */
function formatDocumentType(type?: string): string {
    if (!type) return 'Document';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase().replace(/_/g, ' ');
}

/**
 * Format decision type for display
 */
function formatDecisionType(type?: string): string {
    if (!type) return 'Decision recorded';
    const formatted = type.replace(/_/g, ' ').toLowerCase();
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
