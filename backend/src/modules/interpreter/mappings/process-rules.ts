/**
 * Process Mapping Rules
 *
 * Rules for interpreting CSV rows related to process stages and milestones.
 * Based on patterns observed in the Avisina CSV test data.
 */

import type { MappingRule, MappingContext, MappingOutput } from './types.js';

// Inline fact kind constants
const STAGE_INITIATED = 'STAGE_INITIATED';
const STAGE_COMPLETED = 'STAGE_COMPLETED';
const PROCESS_INITIATED = 'PROCESS_INITIATED';
const PROCESS_COMPLETED = 'PROCESS_COMPLETED';

export const processMappingRules: MappingRule[] = [
    {
        id: 'stage-initiated',
        description: 'Matches stage initiation markers',
        pattern: /^stage\s*\d+|initiate\s*(stage|phase|process)/i,
        emits: (ctx: MappingContext): MappingOutput[] => {
            const match = ctx.text.match(/stage\s*(\d+)/i);
            return [{
                factKind: STAGE_INITIATED,
                payload: {
                    stageName: ctx.stageName,
                    stageNumber: match ? parseInt(match[1], 10) : undefined,
                },
                confidence: 'medium',
            }];
        },
        priority: 10,
    },
    {
        id: 'stage-completed',
        description: 'Matches stage completion markers',
        pattern: /(complete|finish|finalize)\s*(stage|phase)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: STAGE_COMPLETED,
            payload: {
                stageName: ctx.stageName,
            },
            confidence: 'medium',
        }],
        priority: 10,
    },
    {
        id: 'process-initiated',
        description: 'Matches process initiation',
        pattern: /(project\s*)?(kickoff|kick-off|initiation)\s*(meeting)?/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: PROCESS_INITIATED,
            payload: {
                notes: 'Project kickoff',
            },
            confidence: 'medium',
        }],
        priority: 5,
    },
    {
        id: 'milestone',
        description: 'Matches milestone markers (often in status column)',
        pattern: /milestone/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: STAGE_COMPLETED,
            payload: {
                notes: ctx.text,
            },
            confidence: 'high',
        }],
        priority: 15,
        terminal: true,
    },
    {
        id: 'final-documentation',
        description: 'Matches final documentation stage',
        pattern: /final\s*(documentation|report)|submit\s*final/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: PROCESS_COMPLETED,
            payload: {
                notes: 'Final documentation submitted',
            },
            confidence: 'medium',
        }],
        priority: 8,
    },
    {
        id: 'artwork-install',
        description: 'Matches artwork installation milestone',
        pattern: /artwork\s*install(ation)?|install\s*milestone/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: STAGE_COMPLETED,
            payload: {
                stageName: 'Installation',
                notes: 'Artwork installed',
            },
            confidence: 'high',
        }],
        priority: 10,
    },
];
