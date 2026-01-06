/**
 * Invoice & Contract Mapping Rules
 *
 * Rules for interpreting CSV rows as:
 * - INVOICE_PREPARED
 * - PAYMENT_RECORDED
 * - CONTRACT_EXECUTED
 */

import type { MappingRule, MappingContext, MappingOutput } from './types.js';

// Canonical fact kinds
const INVOICE_PREPARED = 'INVOICE_PREPARED';
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
    // Check for named individuals in honorarium requests
    const nameMatch = text.match(/request\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    if (nameMatch) return nameMatch[1];
    return undefined;
}

export const invoiceMappingRules: MappingRule[] = [
    // Invoice rules
    {
        id: 'invoice-drafted',
        description: 'Matches invoice/invocie drafting',
        pattern: /draft\s*(invoice|ivnoice)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INVOICE_PREPARED,
            payload: {
                counterparty: extractCounterparty(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 6,
    },
    {
        id: 'bfa-invoice',
        description: 'BFA Invoice line item',
        pattern: /^bfa\s*invoice/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INVOICE_PREPARED,
            payload: {
                counterparty: 'developer',
            },
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'honorarium-prepared',
        description: 'Artist/panel honorarium',
        pattern: /(artist|selection\s*panel)\s*honorarium/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INVOICE_PREPARED,
            payload: {
                counterparty: ctx.text.toLowerCase().includes('artist') ? 'artist' : 'selection_panel',
            },
            confidence: 'medium',
        }],
        priority: 5,
    },
    {
        id: 'honorarium-request',
        description: 'Individual honorarium request (e.g., Request Tyler Los Jones)',
        pattern: /^request\s+[A-Z][a-z]+\s+[A-Z]/,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INVOICE_PREPARED,
            payload: {
                counterparty: extractCounterparty(ctx.text),
            },
            confidence: 'medium',
        }],
        priority: 4,
    },
    {
        id: 'payment-recorded',
        description: 'Payment received/recorded',
        pattern: /(payment|honorarium)\s*(received|paid|recorded)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: PAYMENT_RECORDED,
            payload: {
                counterparty: extractCounterparty(ctx.text),
            },
            confidence: 'medium',
        }],
        priority: 5,
    },

    // Contract execution
    {
        id: 'contract-executed-status',
        description: 'Status=Executed on contract/proposal items',
        pattern: /^executed$/i,
        emits: (): MappingOutput[] => [{
            factKind: CONTRACT_EXECUTED,
            payload: {},
            confidence: 'high',
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'docusign-executed',
        description: 'Document sent through DocuSign (implies execution process)',
        pattern: /(send|request)\s*(through\s*)?docusign/i,
        emits: (): MappingOutput[] => [{
            factKind: CONTRACT_EXECUTED,
            payload: {
                contractType: 'legal_document',
            },
            confidence: 'medium',
        }],
        priority: 6,
    },
];
