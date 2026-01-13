/**
 * Intent Mapping Rules
 *
 * Rules for classifying work intent from CSV text patterns.
 * 
 * IMPORTANT: This file separates INTENT from OUTCOME.
 * - action_hint: Preparatory/intended work (request, prepare, coordinate)
 * - fact_candidate: Observable outcomes (meeting held, document submitted)
 * 
 * Classification behavior:
 * - action_hint → Never commits (classification only)
 * - fact_candidate → Requires user approval before commit
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';

export const intentMappingRules: MappingRule[] = [
    // ========================================================================
    // ACTION HINTS - Preparatory/internal work (not observable outcomes)
    // These NEVER emit facts. They are classification-only.
    // ========================================================================

    // Request patterns -> action_hint
    // A request is not an outcome - it's intent to obtain something
    {
        id: 'hint-request-generic',
        description: 'Request patterns (not outcomes)',
        pattern: /\b(request|ask\s*for)\s+\w+/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'request',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },

    // Prepare/draft/write/create patterns -> action_hint
    // Creation is not externally observable unless followed by submission
    {
        id: 'hint-prepare-document',
        description: 'Prepare/draft (internal work, not submission)',
        pattern: /\b(prepare|draft|write|create)\s+(written\s*)?(fee\s*proposal|proposal|document|report|manual|checklist|agenda|list)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },

    // Coordinate patterns -> action_hint
    // Coordination is purely orchestration - no fact should be recorded
    {
        id: 'hint-coordinate',
        description: 'Coordination (orchestration, not outcome)',
        pattern: /\bcoordinate\s/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'coordinate',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },

    // Setup patterns -> action_hint
    // Setup is internal preparation (set up budget, set up meeting)
    {
        id: 'hint-setup',
        description: 'Setup/configure (internal preparation)',
        pattern: /\b(set\s*up|setup)\s/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'setup',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },

    // Calculate/compute patterns -> action_hint
    // Internal cognition/prep - not observable
    {
        id: 'hint-calculate',
        description: 'Calculation (internal cognition)',
        pattern: /\b(calculate|compute)\s/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },

    // Confirm/verify patterns -> action_hint
    // Overloaded term - could be decision, logistics, or receipt
    // Minimal fix: treat as action_hint to avoid poisoning event log
    {
        id: 'hint-confirm',
        description: 'Confirm/verify (ambiguous intent)',
        pattern: /\b(confirm|verify)\s/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'communicate',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },

    // ========================================================================
    // FACT CANDIDATES - Observable outcomes (require review before commit)
    // ========================================================================

    // Meeting patterns - borderline, but acceptable as fact_candidate
    // Lexical presence doesn't guarantee occurrence - requires review
    {
        id: 'meeting-generic',
        description: 'Generic meeting pattern (low confidence - requires review)',
        pattern: /\b(meet(ing)?|meeet)\s*(with|to)\b/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: 'MEETING_HELD',
            payload: {
                subject: ctx.text,
            },
            confidence: 'low', // Low confidence - lexical presence doesn't guarantee occurrence
        }],
        priority: 3,
    },

    // Orientation/introduction meeting
    {
        id: 'orientation-meeting',
        description: 'Orientation meeting (low confidence unless status=Done)',
        pattern: /\b(orientation|introduction)\s*(meeting)?/i,
        emits: (_ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: 'MEETING_HELD',
            payload: {
                meetingType: 'orientation',
            },
            confidence: 'low', // Low confidence - CSV doesn't guarantee occurrence
        }],
        priority: 3,
    },

    // File/receive patterns - CORRECT as fact_candidate
    // Receiving a signed contract is an observable fact
    {
        id: 'receive-document',
        description: 'Document received (observable fact)',
        pattern: /\b(received?|file)\s*(executed?|signed|document|contract|proposal|invoice)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: 'DOCUMENT_SUBMITTED',
            payload: {
                documentType: 'received',
                subject: ctx.text,
            },
            confidence: 'medium',
        }],
        priority: 3,
    },
];

// Legacy export name for backward compatibility during migration
export const taskMappingRules = intentMappingRules;
