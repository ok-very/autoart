/**
 * Stage Mapping Rules
 *
 * Rules for interpreting CSV rows as STAGE_ENTERED events.
 * Uses 12 BFA canonical phases aligned 1:1 with bfa_pipeline/config.py VALID_PHASES.
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';

const STAGE_ENTERED = 'STAGE_ENTERED';

/**
 * 12 BFA canonical phases, aligned 1:1 with bfa_pipeline/config.py VALID_PHASES.
 * Maps various aliases to canonical phase names.
 */
const STAGE_ALIASES: Record<string, string> = {
    // 1. Project Initiation
    'project initiation': '1. Project Initiation',
    'initiation': '1. Project Initiation',
    'pre-planning': '1. Project Initiation',
    'planning': '1. Project Initiation',
    'plan': '1. Project Initiation',
    'early stage': '1. Project Initiation',
    '1': '1. Project Initiation',
    '1. project initiation': '1. Project Initiation',

    // 2. PPAP
    'ppap': '2. PPAP',
    'pre-public art plan': '2. PPAP',
    '2': '2. PPAP',
    '2. ppap': '2. PPAP',

    // 3. DPAP
    'dpap': '3. DPAP',
    'design public art plan': '3. DPAP',
    '3': '3. DPAP',
    '3. dpap': '3. DPAP',

    // 4.1. Artist Selection SP#1
    'artist selection sp#1': '4.1. Artist Selection SP#1',
    'sp#1': '4.1. Artist Selection SP#1',
    'sp1': '4.1. Artist Selection SP#1',
    'selection': '4.1. Artist Selection SP#1',
    'artist selection': '4.1. Artist Selection SP#1',
    'call for artists': '4.1. Artist Selection SP#1',
    'eoi': '4.1. Artist Selection SP#1',
    'tor': '4.1. Artist Selection SP#1',
    '4.1': '4.1. Artist Selection SP#1',
    '4.1. artist selection sp#1': '4.1. Artist Selection SP#1',

    // 4.2. Artist Selection SP#2
    'artist selection sp#2': '4.2. Artist Selection SP#2',
    'sp#2': '4.2. Artist Selection SP#2',
    'sp2': '4.2. Artist Selection SP#2',
    '4.2': '4.2. Artist Selection SP#2',
    '4.2. artist selection sp#2': '4.2. Artist Selection SP#2',

    // 5. Artist Contract
    'artist contract': '5. Artist Contract',
    'contract': '5. Artist Contract',
    '5': '5. Artist Contract',
    '5. artist contract': '5. Artist Contract',

    // 6. Detailed Design
    'detailed design': '6. Detailed Design',
    'design': '6. Detailed Design',
    'design development': '6. Detailed Design',
    'dd': '6. Detailed Design',
    '6': '6. Detailed Design',
    '6. detailed design': '6. Detailed Design',

    // 7. Fabrication Start
    'fabrication start': '7. Fabrication Start',
    'fabrication': '7. Fabrication Start',
    '7': '7. Fabrication Start',
    '7. fabrication start': '7. Fabrication Start',

    // 8. 50% Fabrication
    '50% fabrication': '8. 50% Fabrication',
    '8': '8. 50% Fabrication',
    '8. 50% fabrication': '8. 50% Fabrication',

    // 9. 100% Fabrication/Install
    '100% fabrication/install': '9. 100% Fabrication/Install',
    '100% fabrication': '9. 100% Fabrication/Install',
    'installation': '9. 100% Fabrication/Install',
    'install': '9. 100% Fabrication/Install',
    'construction': '9. 100% Fabrication/Install',
    'implementation': '9. 100% Fabrication/Install',
    '9': '9. 100% Fabrication/Install',
    '9. 100% fabrication/install': '9. 100% Fabrication/Install',

    // 10. Final Documents
    'final documents': '10. Final Documents',
    'final docs': '10. Final Documents',
    'closeout': '10. Final Documents',
    'complete': '10. Final Documents',
    'completed': '10. Final Documents',
    'finished': '10. Final Documents',
    'commission complete': '10. Final Documents',
    '10': '10. Final Documents',
    '10. final documents': '10. Final Documents',

    // 11. Photo
    'photo': '11. Photo',
    'unveiled': '11. Photo',
    '11': '11. Photo',
    '11. photo': '11. Photo',

    // TBC
    'tbc': 'TBC',
    'to be confirmed': 'TBC',
};

/**
 * Normalize a stage/phase name to a canonical phase name.
 */
export function normalizeStage(input: string): string | null {
    const normalized = input.toLowerCase().trim();
    return STAGE_ALIASES[normalized] || null;
}

/**
 * Extract stage from context text, handling various patterns.
 */
function extractStageFromText(text: string): { stageName: string; previousStage?: string } | null {
    // Pattern: "move to [stage]", "enter [stage]", "advance to [stage]"
    const moveMatch = text.match(/(?:move|enter|advance|transition)\s+(?:to|into)\s+([a-zA-Z0-9\s#%.\/]+?)(?:\s+stage|\s+phase)?$/i);
    if (moveMatch) {
        const stage = normalizeStage(moveMatch[1]);
        if (stage) return { stageName: stage };
    }

    // Pattern: "[stage] stage/phase entered"
    const enteredMatch = text.match(/^([a-zA-Z0-9\s#%.\/]+?)\s+(?:stage|phase)\s+(?:entered|started|begun)/i);
    if (enteredMatch) {
        const stage = normalizeStage(enteredMatch[1]);
        if (stage) return { stageName: stage };
    }

    // Pattern: "from [stage] to [stage]"
    const transitionMatch = text.match(/from\s+([a-zA-Z0-9\s#%.\/]+?)\s+to\s+([a-zA-Z0-9\s#%.\/]+?)(?:\s+stage|\s+phase)?$/i);
    if (transitionMatch) {
        const from = normalizeStage(transitionMatch[1]);
        const to = normalizeStage(transitionMatch[2]);
        if (to) return { stageName: to, previousStage: from || undefined };
    }

    // Direct stage name match
    const directMatch = text.match(/^([a-zA-Z0-9\s#%.\/]+?)\s*$/i);
    if (directMatch) {
        const stage = normalizeStage(directMatch[1]);
        if (stage) return { stageName: stage };
    }

    return null;
}

export const stageMappingRules: MappingRule[] = [
    {
        id: 'stage-transition-explicit',
        description: 'Explicit stage/phase transition (e.g., "move to Detailed Design")',
        pattern: /(?:move|enter|advance|transition)\s+(?:to|into)\s+[a-zA-Z0-9\s#%.\/]+(?:\s+stage|\s+phase)?/i,
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
        description: 'Passive stage entry (e.g., "Detailed Design phase entered")',
        pattern: /[a-zA-Z0-9\s#%.\/]+\s+(?:stage|phase)\s+(?:entered|started|begun)/i,
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
        description: 'Stage transition with from/to (e.g., "from PPAP to DPAP")',
        pattern: /from\s+[a-zA-Z0-9\s#%.\/]+\s+to\s+[a-zA-Z0-9\s#%.\/]+/i,
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
        description: 'Phase value in status column (canonical numbered phases + legacy names)',
        pattern: /^(?:\d+(?:\.\d+)?\.?\s+)?(?:project initiation|ppap|dpap|artist selection(?:\s+sp#?[12])?|artist contract|detailed design|fabrication(?:\s+start)?|50%\s*fabrication|100%\s*fabrication(?:\/install)?|final documents|photo|tbc|planning|selection|design|installation|complete|completed)$/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const stage = normalizeStage(ctx.text);
            if (!stage) return [];

            return [{
                kind: 'fact_candidate',
                factKind: STAGE_ENTERED,
                payload: {
                    stageName: stage,
                },
                confidence: 'medium',
            }];
        },
        priority: 8,
    },

    // =========================================================================
    // BFA-specific patterns
    // =========================================================================
    {
        id: 'stage-on-hold',
        description: 'Project on hold — pauses phase progression',
        pattern: /\bon\s+hold\b/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: STAGE_ENTERED,
            payload: {
                stageName: 'On Hold',
            },
            confidence: 'high',
        }],
        priority: 12,
        terminal: true,
    },
    {
        id: 'schedule-status',
        description: 'BFA schedule status (on schedule, behind schedule, etc.)',
        pattern: /(?:on|behind|ahead\s+of)\s+(?:schedule|track)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const lowerText = ctx.text.toLowerCase();
            let status = 'on_schedule';
            if (lowerText.includes('behind')) status = 'behind_schedule';
            else if (lowerText.includes('ahead')) status = 'ahead_of_schedule';

            return [{
                kind: 'field_value',
                field: 'schedule_status',
                value: status,
                confidence: 'high',
            }];
        },
        priority: 6,
    },
];
