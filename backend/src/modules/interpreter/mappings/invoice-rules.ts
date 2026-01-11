/**
 * Invoice & Contract Mapping Rules
 *
 * Rules for interpreting CSV rows related to invoices and contracts.
 * 
 * IMPORTANT: Separates INTENT from OUTCOME.
 * - Drafting is action_hint (internal work)
 * - Requests are action_hint (intent)
 * - Payment received/contract executed is fact_candidate (observable)
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';

// Canonical fact kinds
const PAYMENT_RECORDED = 'PAYMENT_RECORDED';
const CONTRACT_EXECUTED = 'CONTRACT_EXECUTED';

/**
 * Extract counterparty from text
 */
function extractCounterparty(text: string): string | undefined {
    const lower = text.toLowerCase();
    if (lower.includes('developer')) return 'developer';
    if (lower.includes('artist')) return 'artist';
    if (lower.includes('city')) return 'city';
    if (lower.includes('client')) return 'client';
    return undefined;
}

export const invoiceMappingRules: MappingRule[] = [
    // ========================================================================
    // ACTION HINTS - Drafting/requesting is internal work or intent
    // ========================================================================
    {
        id: 'invoice-drafted',
        description: 'Draft invoice (internal work)',
        pattern: /draft\s*(invoice|ivnoice)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'bfa-invoice-prep',
        description: 'BFA Invoice line item (preparation)',
        pattern: /^bfa\s*invoice/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'honorarium-prep',
        description: 'Honorarium preparation',
        pattern: /(artist|selection\s*panel)\s*honorarium/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'honorarium-request',
        description: 'Individual honorarium request (intent)',
        pattern: /^request\s+[A-Z][a-z]+\s+[A-Z]/,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'request',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },

    // ========================================================================
    // FACT CANDIDATES - Observable financial/legal outcomes
    // ========================================================================
    {
        id: 'payment-recorded',
        description: 'Payment received/recorded (observable)',
        pattern: /(payment|honorarium)\s*(received|paid|recorded)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: PAYMENT_RECORDED,
            payload: {
                counterparty: extractCounterparty(ctx.text),
            },
            confidence: 'medium',
        }],
        priority: 5,
    },
    {
        id: 'contract-executed-status',
        description: 'Status=Executed on contract/proposal items',
        pattern: /^executed$/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: CONTRACT_EXECUTED,
            payload: {},
            confidence: 'high', // Status-based - strong signal
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'docusign-sent',
        description: 'Document sent through DocuSign (observable)',
        pattern: /send\s*(through\s*)?docusign/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: CONTRACT_EXECUTED,
            payload: {
                contractType: 'legal_document',
            },
            confidence: 'medium',
        }],
        priority: 6,
    },
    // Note: "request docusign" is different from "send docusign"
    {
        id: 'docusign-request',
        description: 'Request DocuSign (intent)',
        pattern: /request\s*(through\s*)?docusign/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'request',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
];
