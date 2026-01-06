/**
 * Invoice Mapping Rules
 *
 * Rules for interpreting CSV rows related to invoices, contracts, and documents.
 * Based on patterns observed in the Avisina CSV test data.
 */

import type { MappingRule, MappingContext, MappingOutput } from './types.js';

// Inline fact kind constants
const INVOICE_DRAFTED = 'INVOICE_DRAFTED';
const INVOICE_SUBMITTED = 'INVOICE_SUBMITTED';
const PAYMENT_RECORDED = 'PAYMENT_RECORDED';
const CONTRACT_DRAFTED = 'CONTRACT_DRAFTED';
const CONTRACT_SENT = 'CONTRACT_SENT';
const SIGNATURE_REQUESTED = 'SIGNATURE_REQUESTED';
const CONTRACT_EXECUTED = 'CONTRACT_EXECUTED';
const DOCUMENT_FILED = 'DOCUMENT_FILED';
const DOCUMENT_SUBMITTED = 'DOCUMENT_SUBMITTED';
const DOCUMENT_APPROVED = 'DOCUMENT_APPROVED';

export const invoiceMappingRules: MappingRule[] = [
    // Invoice rules
    {
        id: 'invoice-drafted',
        description: 'Matches invoice drafting',
        pattern: /draft\s*(invoice|ivnoice)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INVOICE_DRAFTED,
            payload: {},
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'invoice-submitted',
        description: 'Matches invoice submission',
        pattern: /submit\s*(invoice|honorarium|artist\s*invoice)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INVOICE_SUBMITTED,
            payload: {},
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'payment-recorded',
        description: 'Matches payment recording',
        pattern: /(payment|honorarium)\s*(received|paid|recorded)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: PAYMENT_RECORDED,
            payload: {},
            confidence: 'medium',
        }],
        priority: 5,
    },

    // Contract rules
    {
        id: 'contract-drafted',
        description: 'Matches contract drafting',
        pattern: /draft\s*(artist\s*)?(contract|agreement)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: CONTRACT_DRAFTED,
            payload: {},
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'contract-sent',
        description: 'Matches contract sending for approval/signature',
        pattern: /submit\s*(contract|agreement)\s*(to|for)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: CONTRACT_SENT,
            payload: {},
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'signature-requested',
        description: 'Matches signature requests',
        pattern: /(send|request)\s*(through\s*)?docusign|request\s*signature/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: SIGNATURE_REQUESTED,
            payload: {
                sentVia: 'docusign',
            },
            confidence: 'high',
        }],
        priority: 6,
    },
    {
        id: 'contract-executed',
        description: 'Matches executed contracts (status-based)',
        pattern: /executed|signed\s*(contract|fee\s*proposal)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: CONTRACT_EXECUTED,
            payload: {},
            confidence: 'high',
        }],
        priority: 8,
    },

    // Document rules
    {
        id: 'document-filed',
        description: 'Matches document filing',
        pattern: /file\s*(contract|document)|saved?\s*to\s*(file|folder)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: DOCUMENT_FILED,
            payload: {},
            confidence: 'medium',
        }],
        priority: 4,
    },
    {
        id: 'document-submitted',
        description: 'Matches document submission to external parties',
        pattern: /submit\s*(to\s*)?(city|developer|client)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: DOCUMENT_SUBMITTED,
            payload: {
                submittedTo: ctx.text.match(/(city|developer|client)/i)?.[1],
            },
            confidence: 'medium',
        }],
        priority: 4,
    },
    {
        id: 'document-approved',
        description: 'Matches approvals from external parties',
        pattern: /(city|developer|client)\s*(approval|approved)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: DOCUMENT_APPROVED,
            payload: {
                approvedBy: ctx.text.match(/(city|developer|client)/i)?.[1],
            },
            confidence: 'medium',
        }],
        priority: 5,
    },
];
