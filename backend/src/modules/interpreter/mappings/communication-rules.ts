/**
 * Communication Mapping Rules
 *
 * Rules for interpreting CSV rows as INFORMATION_SENT.
 * Funnels: requests, submissions, reminders, follow-ups, invitations
 */

import type { MappingRule, MappingContext, MappingOutput } from './types.js';

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
    // Requests
    {
        id: 'request-availability',
        description: 'Request for meeting availability',
        pattern: /request\s*(meeting\s*)?availability/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'availability',
                audiences: extractAudience(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'request-files',
        description: 'Request for project files/documents',
        pattern: /request\s*(project\s*)?(files?|documents?|proof|information)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'files',
                audiences: extractAudience(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'request-invoice',
        description: 'Request for artist invoice',
        pattern: /request\s*(artist\s*)?invoice/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'invoice',
                audiences: ['artist'],
            },
            confidence: 'high',
        }],
        priority: 5,
    },

    // Submissions
    {
        id: 'submit-materials',
        description: 'Submit materials/presentations to recipients',
        pattern: /(submit|send)\s*(artist\s*)?(presentations?|materials?|longlist|shortlist)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'materials',
                audiences: extractAudience(ctx.text),
                artifacts: ['materials'],
            },
            confidence: 'high',
        }],
        priority: 6,
    },
    {
        id: 'submit-to-party',
        description: 'Submit document to city/developer/client',
        pattern: /submit\s+\w+\s+(to\s+)?(city|developer|client)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'document',
                audiences: extractAudience(ctx.text),
            },
            confidence: 'medium',
        }],
        priority: 4,
    },

    // Invitations
    {
        id: 'invite-members',
        description: 'Invite panel/advisory/artist members',
        pattern: /invite\s*(selection\s*panel|community\s*advisory|shortlisted\s*artists?)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'invitation',
                audiences: extractAudience(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'send-invite',
        description: 'Send meeting invite',
        pattern: /(send|send\s*out)\s*(meeting\s*)?invite/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'meeting invite',
                audiences: ['attendees'],
            },
            confidence: 'high',
        }],
        priority: 5,
    },

    // Reminders
    {
        id: 'send-reminder',
        description: 'Send reminder communications',
        pattern: /(send|group)\s*reminder/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'reminder',
                audiences: extractAudience(ctx.text),
            },
            confidence: 'high',
        }],
        priority: 5,
    },

    // Follow-ups
    {
        id: 'follow-up-email',
        description: 'Follow-up email/communication',
        pattern: /follow[\s-]?up\s*(email|meeting|call)?/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'follow-up',
                audiences: extractAudience(ctx.text),
                channel: ctx.text.toLowerCase().includes('email') ? 'email' : undefined,
            },
            confidence: 'medium',
        }],
        priority: 5,
    },
    {
        id: 'send-notes',
        description: 'Send meeting notes',
        pattern: /send\s*(out\s*)?(meeting\s*)?notes/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'meeting notes',
                audiences: ['attendees'],
                channel: 'email',
            },
            confidence: 'high',
        }],
        priority: 5,
    },

    // Email patterns
    {
        id: 'email-details',
        description: 'Email details to recipient',
        pattern: /email\s+\w+\s+(details|information)\s+(to\s+)?/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: INFORMATION_SENT,
            payload: {
                subject: 'details',
                audiences: extractAudience(ctx.text),
                channel: 'email',
            },
            confidence: 'medium',
        }],
        priority: 4,
    },
];
