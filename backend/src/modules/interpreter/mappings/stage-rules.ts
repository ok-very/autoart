/**
 * Stage Mapping Rules
 *
 * Rules for interpreting CSV rows as STAGE_ENTERED events.
 * Handles phase-to-stage migration: "phase" language is deprecated,
 * mapped to "stage" terminology (Planning, Selection, Design, Installation, Complete).
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';

const STAGE_ENTERED = 'STAGE_ENTERED';

/**
 * Stage name normalization - maps various phase/stage terms to canonical stage names.
 */
const STAGE_ALIASES: Record<string, string> = {
    // Planning stage
    'planning': 'Planning',
    'plan': 'Planning',
    'pre-planning': 'Planning',
    'early stage': 'Planning',
    'initiation': 'Planning',
    'ppap': 'Planning', // Pre-Public Art Plan

    // Selection stage
    'selection': 'Selection',
    'artist selection': 'Selection',
    'call for artists': 'Selection',
    'sp1': 'Selection',
    'sp#1': 'Selection',
    'eoi': 'Selection', // Expression of Interest
    'tor': 'Selection', // Terms of Reference

    // Design stage
    'design': 'Design',
    'design development': 'Design',
    'dpap': 'Design', // Design Public Art Plan
    'dd': 'Design',
    'fabrication': 'Design',

    // Installation stage
    'installation': 'Installation',
    'install': 'Installation',
    'construction': 'Installation',
    'implementation': 'Installation',

    // Complete stage
    'complete': 'Complete',
    'completed': 'Complete',
    'finished': 'Complete',
    'unveiled': 'Complete',
    'commission complete': 'Complete',
};

/**
 * Normalize a stage/phase name to a canonical stage name.
 */
function normalizeStage(input: string): string | null {
    const normalized = input.toLowerCase().trim();
    return STAGE_ALIASES[normalized] || null;
}

/**
 * Extract stage from context text, handling various patterns.
 */
function extractStageFromText(text: string): { stageName: string; previousStage?: string } | null {
    // Pattern: "move to [stage]", "enter [stage]", "advance to [stage]"
    const moveMatch = text.match(/(?:move|enter|advance|transition)\s+(?:to|into)\s+([a-zA-Z\s#]+?)(?:\s+stage|\s+phase)?$/i);
    if (moveMatch) {
        const stage = normalizeStage(moveMatch[1]);
        if (stage) return { stageName: stage };
    }

    // Pattern: "[stage] stage/phase entered"
    const enteredMatch = text.match(/^([a-zA-Z\s#]+?)\s+(?:stage|phase)\s+(?:entered|started|begun)/i);
    if (enteredMatch) {
        const stage = normalizeStage(enteredMatch[1]);
        if (stage) return { stageName: stage };
    }

    // Pattern: "from [stage] to [stage]"
    const transitionMatch = text.match(/from\s+([a-zA-Z\s#]+?)\s+to\s+([a-zA-Z\s#]+?)(?:\s+stage|\s+phase)?$/i);
    if (transitionMatch) {
        const from = normalizeStage(transitionMatch[1]);
        const to = normalizeStage(transitionMatch[2]);
        if (to) return { stageName: to, previousStage: from || undefined };
    }

    // Direct stage name match
    const directMatch = text.match(/^([a-zA-Z\s#]+?)\s*$/i);
    if (directMatch) {
        const stage = normalizeStage(directMatch[1]);
        if (stage) return { stageName: stage };
    }

    return null;
}

export const stageMappingRules: MappingRule[] = [
    {
        id: 'stage-transition-explicit',
        description: 'Explicit stage/phase transition (e.g., "move to Design stage")',
        pattern: /(?:move|enter|advance|transition)\s+(?:to|into)\s+[a-zA-Z\s#]+(?:\s+stage|\s+phase)?/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const extracted = extractStageFromText(ctx.text);
            if (!extracted) return [];

            return [{
                kind: 'fact_candidate',
                factKind: STAGE_ENTERED,
                payload: {
                    stageName: extracted.stageName,
                    previousStage: extracted.previousStage,
                },
                confidence: 'high',
            }];
        },
        priority: 12,
        terminal: true,
    },
    {
        id: 'stage-entered-passive',
        description: 'Passive stage entry (e.g., "Design stage entered")',
        pattern: /[a-zA-Z\s#]+\s+(?:stage|phase)\s+(?:entered|started|begun)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const extracted = extractStageFromText(ctx.text);
            if (!extracted) return [];

            return [{
                kind: 'fact_candidate',
                factKind: STAGE_ENTERED,
                payload: {
                    stageName: extracted.stageName,
                },
                confidence: 'high',
            }];
        },
        priority: 11,
        terminal: true,
    },
    {
        id: 'stage-from-to',
        description: 'Stage transition with from/to (e.g., "from Selection to Design")',
        pattern: /from\s+[a-zA-Z\s#]+\s+to\s+[a-zA-Z\s#]+/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const extracted = extractStageFromText(ctx.text);
            if (!extracted) return [];

            return [{
                kind: 'fact_candidate',
                factKind: STAGE_ENTERED,
                payload: {
                    stageName: extracted.stageName,
                    previousStage: extracted.previousStage,
                },
                confidence: 'high',
            }];
        },
        priority: 11,
        terminal: true,
    },
    {
        id: 'phase-status-column',
        description: 'Phase value in status column (deprecated → stage)',
        pattern: /^(planning|selection|design|installation|complete|ppap|dpap)$/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            // This rule handles when the status column contains a phase name
            const stage = normalizeStage(ctx.text);
            if (!stage) return [];

            return [{
                kind: 'fact_candidate',
                factKind: STAGE_ENTERED,
                payload: {
                    stageName: stage,
                },
                confidence: 'medium', // Medium confidence for status-column matches
            }];
        },
        priority: 8,
    },
];
