/**
 * Meeting Mapping Rules
 *
 * Rules for interpreting CSV rows related to meetings.
 * 
 * IMPORTANT: Separates INTENT from OUTCOME.
 * - Scheduling/coordination is action_hint (intent)
 * - Meeting held (with evidence) is fact_candidate (observable)
 * 
 * Note: Lexical patterns like "meeting with" don't guarantee occurrence.
 * Use low confidence and require status confirmation for high confidence.
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';
import { extractDateFromContext } from './types.js';

// Canonical fact kinds
const MEETING_HELD = 'MEETING_HELD';

export const meetingMappingRules: MappingRule[] = [
    // ========================================================================
    // FACT CANDIDATES - Observable meeting outcomes
    // ========================================================================

    // Meeting explicitly marked as held/completed - strong signal
    {
        id: 'meeting-held',
        description: 'Meeting explicitly marked as held/occurred',
        pattern: /meeting\s*(date|held|occurred|completed)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MEETING_HELD,
            payload: {
                occurredAt: extractDateFromContext(ctx),
            },
            confidence: 'medium', // Still needs review - could be planned date
        }],
        priority: 10,
    },

    // City/PAC presentations - likely observable events
    {
        id: 'city-meeting',
        description: 'City/PAC presentations as meetings',
        pattern: /(city\s*presentation|PAC\s*meeting|public\s*art\s*committee)/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MEETING_HELD,
            payload: {
                participants: ['city'],
            },
            confidence: 'low', // Lexical pattern - requires review
        }],
        priority: 6,
    },

    // ========================================================================
    // ACTION HINTS - Scheduling/coordination is intent, not outcome
    // ========================================================================

    // Meeting scheduling is intent, not outcome
    {
        id: 'meeting-scheduled',
        description: 'Meeting scheduling/coordination (intent)',
        pattern: /(schedule|confirm|coordinate)\s*(meeting|selection\s*panel|sp\d|kick-?off)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'coordinate',
            text: ctx.text,
        }],
        priority: 8,
        terminal: true,
    },

    // Kickoff as lexical pattern - could be planning or execution
    {
        id: 'kickoff-meeting',
        description: 'Kickoff meeting (ambiguous - could be planned or held)',
        pattern: /(project\s*)?(kickoff|kick-off)\s*(meeting)?/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MEETING_HELD,
            payload: {
                meetingType: 'kickoff',
            },
            confidence: 'low', // Requires status confirmation
        }],
        priority: 7,
    },
];
