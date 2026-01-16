/**
 * Communication Mapping Rules
 *
 * Rules for interpreting CSV rows related to communication.
 * 
 * IMPORTANT: Separates INTENT from OUTCOME.
 * - Requests are action_hints (intent to obtain)
 * - Sends/submits are fact_candidates (observable outcomes)
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';

const INFORMATION_SENT = 'INFORMATION_SENT';

/**
 * Extract audience from text patterns
 */
function extractAudience(text: string): string[] {
    const audiences: string[] = [];
    const lower = text.toLowerCase();

    if (lower.includes('developer')) audiences.push('developer');
    if (lower.includes('client')) audiences.push('client');
    if (lower.includes('city')) audiences.push('city');
    if (lower.includes('artist')) audiences.push('artist');
    if (lower.includes('selection panel') || lower.includes('sp ')) audiences.push('selection_panel');
    if (lower.includes('community')) audiences.push('community');

    return audiences.length > 0 ? audiences : ['recipient'];
}

export const communicationMappingRules: MappingRule[] = [
    // ========================================================================
    // ACTION HINTS - Requests are intent, not outcomes
    // ========================================================================
    {
        id: 'request-availability',
        description: 'Request for meeting availability (intent)',
        pattern: /request\s*(meeting\s*)?availability/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'request',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'request-files',
        description: 'Request for project files/documents (intent)',
        pattern: /request\s*(project\s*)?(files?|documents?|proof|information)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'request',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'request-invoice',
        description: 'Request for invoice (intent)',
        pattern: /request\s*(artist\s*)?invoice/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'request',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },

    // ========================================================================
    // FACT CANDIDATES - Observable communication outcomes
    // ========================================================================

    // Submissions - explicit send/submit actions
    {
        id: 'submit-materials',
        description: 'Submit materials/presentations to recipients',
        pattern: /(submit|send)\s*(artist\s*)?(presentations?|materials?|longlist|shortlist)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'materials',
                audiences: extractAudience(ctx.text),
                artifacts: ['materials'],
            },
            confidence: 'medium', // Lowered - send/submit is intent until confirmed
        }],
        priority: 6,
    },
    {
        id: 'submit-to-party',
        description: 'Submit document to city/developer/client',
        pattern: /submit\s+\w+\s+(to\s+)?(city|developer|client)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'document',
                audiences: extractAudience(ctx.text),
            },
            confidence: 'medium',
        }],
        priority: 4,
    },

    // Invitations - observable if sent
    {
        id: 'invite-members',
        description: 'Invite panel/advisory/artist members',
        pattern: /invite\s*(selection\s*panel|community\s*advisory|shortlisted\s*artists?)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'invitation',
                audiences: extractAudience(ctx.text),
            },
            confidence: 'medium',
        }],
        priority: 5,
    },
    {
        id: 'send-invite',
        description: 'Send meeting invite',
        pattern: /(send|send\s*out)\s*(meeting\s*)?invite/i,
        emits: (_ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'meeting invite',
                audiences: ['attendees'],
            },
            confidence: 'medium',
        }],
        priority: 5,
    },

    // Reminders - observable if sent
    {
        id: 'send-reminder',
        description: 'Send reminder communications',
        pattern: /(send|group)\s*reminder/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'reminder',
                audiences: extractAudience(ctx.text),
            },
            confidence: 'medium',
        }],
        priority: 5,
    },

    // Follow-ups - treated as intent (action_hint) since completion isn't guaranteed
    {
        id: 'follow-up-email',
        description: 'Follow-up communication (intent)',
        pattern: /follow[\s-]?up\s*(email|meeting|call)?/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'communicate',
            text: ctx.text,
        }],
        priority: 5,
    },

    // Send notes - observable outcome
    {
        id: 'send-notes',
        description: 'Send meeting notes',
        pattern: /send\s*(out\s*)?(meeting\s*)?notes/i,
        emits: (_ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'meeting notes',
                audiences: ['attendees'],
                channel: 'email',
            },
            confidence: 'medium',
        }],
        priority: 5,
    },

    // Email patterns - observable outcome
    {
        id: 'email-details',
        description: 'Email details to recipient',
        pattern: /email\s+\w+\s+(details|information)\s+(to\s+)?/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'details',
                audiences: extractAudience(ctx.text),
                channel: 'email',
            },
            confidence: 'low', // Lexical pattern doesn't guarantee send
        }],
        priority: 4,
    },
];
