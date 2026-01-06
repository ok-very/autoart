/**
 * Process Mapping Rules
 *
 * Rules for interpreting CSV rows as:
 * - PROCESS_INITIATED
 * - PROCESS_COMPLETED
 *
 * Note: Stage events are projection-level concerns, not facts.
 * Milestones are now captured as DECISION_RECORDED.
 */

import type { MappingRule, MappingContext, MappingOutput } from './types.js';

// Canonical fact kinds
const PROCESS_INITIATED = 'PROCESS_INITIATED';
const PROCESS_COMPLETED = 'PROCESS_COMPLETED';

export const processMappingRules: MappingRule[] = [
    {
        id: 'process-initiated',
        description: 'Project initiation/kickoff',
        pattern: /^(project\s*)?(initiation|kickoff|kick-off)$/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: PROCESS_INITIATED,
            payload: {
                processName: ctx.stageName || 'Project',
            },
            confidence: 'medium',
        }],
        priority: 8,
    },
    {
        id: 'stage-header-initiated',
        description: 'Stage header row (Stage 1: Project Initiation)',
        pattern: /^stage\s*\d+:\s*project\s*initiation/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: PROCESS_INITIATED,
            payload: {
                processName: ctx.stageName || 'Project Initiation',
            },
            confidence: 'high',
        }],
        priority: 10,
    },
    {
        id: 'final-documentation',
        description: 'Final documentation/report submission',
        pattern: /submit\s*final\s*(report|documentation)/i,
        emits: (): MappingOutput[] => [{
            factKind: PROCESS_COMPLETED,
            payload: {
                processName: 'Public Art Process',
            },
            confidence: 'high',
        }],
        priority: 8,
    },
    {
        id: 'unveiling-event',
        description: 'Unveiling event (process completion marker)',
        pattern: /unveiling\s*event/i,
        emits: (): MappingOutput[] => [{
            factKind: PROCESS_COMPLETED,
            payload: {
                processName: 'Installation',
            },
            confidence: 'high',
        }],
        priority: 7,
    },
];
