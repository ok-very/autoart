/**
 * Meeting Mapping Rules
 *
 * Rules for interpreting CSV rows related to meetings and coordination.
 * Based on patterns observed in the Avisina CSV test data.
 */

import type { MappingRule, MappingContext, MappingOutput } from './types.js';
import { extractDateFromContext } from './types.js';

// Inline fact kind constants to avoid shared module dependency during build
const MEETING_HELD = 'MEETING_HELD';
const MEETING_SCHEDULED = 'MEETING_SCHEDULED';
const AGENDA_PREPARED = 'AGENDA_PREPARED';
const MATERIALS_SENT = 'MATERIALS_SENT';
const REMINDER_SENT = 'REMINDER_SENT';
const FOLLOWED_UP = 'FOLLOWED_UP';

export const meetingMappingRules: MappingRule[] = [
    {
        id: 'meeting-held',
        description: 'Matches meeting dates and meeting held events',
        pattern: /meeting\s*(date|held|occurred|completed)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: MEETING_HELD,
            payload: {
                occurredAt: extractDateFromContext(ctx),
            },
            confidence: 'medium',
        }],
        priority: 10,
    },
    {
        id: 'meeting-scheduled',
        description: 'Matches meeting scheduling and invites',
        pattern: /(schedule|confirm|coordinate)\s*(meeting|selection\s*panel|sp\d)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: MEETING_SCHEDULED,
            payload: {
                plannedAt: extractDateFromContext(ctx),
            },
            confidence: 'medium',
        }],
        priority: 5,
    },
    {
        id: 'agenda-prepared',
        description: 'Matches agenda creation',
        pattern: /(create|prepare|draft)\s*(meeting\s*)?agenda/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: AGENDA_PREPARED,
            payload: {},
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'materials-sent',
        description: 'Matches sending materials or presentations',
        pattern: /(submit|send)\s*(artist\s*)?(presentations?|materials?|longlist|shortlist)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: MATERIALS_SENT,
            payload: {
                materials: ctx.text.includes('presentation') ? ['presentations'] : undefined,
            },
            confidence: 'medium',
        }],
        priority: 5,
    },
    {
        id: 'reminder-sent',
        description: 'Matches reminder communications',
        pattern: /(send|group)\s*reminder/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: REMINDER_SENT,
            payload: {},
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'follow-up',
        description: 'Matches follow-up communications',
        pattern: /follow[\s-]?up\s*(email|meeting|call)?/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: FOLLOWED_UP,
            payload: {
                channel: ctx.text.toLowerCase().includes('email') ? 'email' : undefined,
            },
            confidence: 'medium',
        }],
        priority: 5,
    },
    {
        id: 'meeting-availability',
        description: 'Matches availability requests (part of scheduling)',
        pattern: /request\s*(meeting\s*)?availability/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: MEETING_SCHEDULED,
            payload: {
                notes: 'Availability requested',
            },
            confidence: 'low',
        }],
        priority: 3,
    },
    {
        id: 'meeting-invite',
        description: 'Matches meeting invitations',
        pattern: /(send|send\s*out)\s*(meeting\s*)?invite/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: MEETING_SCHEDULED,
            payload: {
                notes: 'Invite sent',
            },
            confidence: 'medium',
        }],
        priority: 4,
    },
    {
        id: 'meeting-notes',
        description: 'Matches meeting notes distribution',
        pattern: /send\s*(out\s*)?(meeting\s*)?notes/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: FOLLOWED_UP,
            payload: {
                channel: 'email',
                notes: 'Meeting notes sent',
            },
            confidence: 'medium',
        }],
        priority: 4,
    },
];
