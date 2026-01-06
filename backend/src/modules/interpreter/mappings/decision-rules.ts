/**
 * Decision Mapping Rules
 *
 * Rules for interpreting CSV rows as DECISION_RECORDED.
 * Captures: milestones, approvals, artist selections
 */

import type { MappingRule, MappingContext, MappingOutput } from './types.js';

const DECISION_RECORDED = 'DECISION_RECORDED';

export const decisionMappingRules: MappingRule[] = [
    {
        id: 'milestone-status',
        description: 'Matches MILESTONE status (from CSV status column)',
        pattern: /^milestone$/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: DECISION_RECORDED,
            payload: {
                decisionType: 'milestone_reached',
                subject: ctx.parentTitle || ctx.text,
            },
            confidence: 'high',
        }],
        priority: 15,
        terminal: true,
    },
    {
        id: 'final-selected-artist',
        description: 'Final artist selection',
        pattern: /final\s*selected\s*artist/i,
        emits: (): MappingOutput[] => [{
            factKind: DECISION_RECORDED,
            payload: {
                decisionType: 'artist_selected',
            },
            confidence: 'high',
        }],
        priority: 10,
    },
    {
        id: 'city-approval',
        description: 'City approval of document/plan',
        pattern: /city\s*approval|approved\s*by\s*city/i,
        emits: (): MappingOutput[] => [{
            factKind: DECISION_RECORDED,
            payload: {
                decisionType: 'approval_granted',
                subject: 'document',
            },
            confidence: 'high',
        }],
        priority: 8,
    },
    {
        id: 'signed-received',
        description: 'Signed proposal/contract received',
        pattern: /signed\s*(fee\s*proposal|contract)\s*received/i,
        emits: (): MappingOutput[] => [{
            factKind: DECISION_RECORDED,
            payload: {
                decisionType: 'approval_granted',
            },
            confidence: 'high',
        }],
        priority: 8,
    },
    {
        id: 'artwork-install-milestone',
        description: 'Artwork installation milestone',
        pattern: /artwork\s*install(ation)?\s*milestone/i,
        emits: (): MappingOutput[] => [{
            factKind: DECISION_RECORDED,
            payload: {
                decisionType: 'milestone_reached',
                subject: 'installation',
            },
            confidence: 'high',
        }],
        priority: 10,
    },
];
