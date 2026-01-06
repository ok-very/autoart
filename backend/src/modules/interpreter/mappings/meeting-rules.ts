/**
 * Meeting Mapping Rules
 *
 * Rules for interpreting CSV rows related to meetings.
 * Emits only canonical fact families: MEETING_SCHEDULED, MEETING_HELD
 */

import type { MappingRule, MappingContext, MappingOutput } from './types.js';
import { extractDateFromContext } from './types.js';

// Canonical fact kinds
const MEETING_SCHEDULED = 'MEETING_SCHEDULED';
const MEETING_HELD = 'MEETING_HELD';

export const meetingMappingRules: MappingRule[] = [
    {
        id: 'meeting-held',
        description: 'Matches meeting held/occurred events',
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
        description: 'Matches meeting scheduling/coordination',
        pattern: /(schedule|confirm|coordinate)\s*(meeting|selection\s*panel|sp\d|kick-?off)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: MEETING_SCHEDULED,
            payload: {
                plannedAt: extractDateFromContext(ctx),
            },
            confidence: 'medium',
        }],
        priority: 8,
    },
    {
        id: 'kickoff-meeting',
        description: 'Matches project kickoff meetings',
        pattern: /(project\s*)?(kickoff|kick-off)\s*(meeting)?/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: MEETING_HELD,
            payload: {},
            confidence: 'medium',
        }],
        priority: 7,
    },
    {
        id: 'city-meeting',
        description: 'Matches city/PAC presentations as meetings',
        pattern: /(city\s*presentation|PAC\s*meeting|public\s*art\s*committee)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: MEETING_HELD,
            payload: {
                participants: ['city'],
            },
            confidence: 'medium',
        }],
        priority: 6,
    },
];
