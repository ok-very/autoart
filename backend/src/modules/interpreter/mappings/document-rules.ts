/**
 * Document Mapping Rules
 *
 * Rules for interpreting CSV rows related to documents.
 * 
 * IMPORTANT: Separates INTENT from OUTCOME.
 * - Preparation/drafting is action_hint (internal work, not observable)
 * - Submission/presentation is fact_candidate (externally observable)
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';

const DOCUMENT_SUBMITTED = 'DOCUMENT_SUBMITTED';

export const documentMappingRules: MappingRule[] = [
    // ========================================================================
    // ACTION HINTS - Preparation is internal work, not observable
    // These should NEVER emit facts. Preparation != Submission.
    // ========================================================================
    {
        id: 'prepare-agenda',
        description: 'Prepare/create meeting agenda (internal work)',
        pattern: /(create|prepare|draft)\s*(meeting\s*)?agenda/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'draft-checklist',
        description: 'Draft checklist (internal work)',
        pattern: /draft\s*checklist/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'create-folder',
        description: 'Create project folder (internal work)',
        pattern: /create\s*(project\s*)?folder/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'setup',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'setup-budget',
        description: 'Set up budget/invoice template (internal work)',
        pattern: /set\s*up\s*(bfa\s*)?(master\s*)?budget|set\s*up\s*invoice\s*template/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'setup',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'prepare-proposal',
        description: 'Prepare written proposal (internal work)',
        pattern: /prepare\s*(written\s*)?(fee\s*)?proposal/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'write-section',
        description: 'Write section (internal work)',
        pattern: /write\s*(public\s*art\s*opportunity|selection\s*process)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'create-document',
        description: 'Create document (internal work)',
        pattern: /create\s*(voting\s*table|indesign\s*document|thumbnail\s*sheet)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'fill-template',
        description: 'Fill out template (internal work)',
        pattern: /fill\s*(out\s*)?(plaque|stat\s*dec)\s*template/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },
    {
        id: 'draft-legal',
        description: 'Draft legal documents (internal work)',
        pattern: /draft\s*(aa|tot|letter\s*of\s*acceptance|transfer\s*of\s*title)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'action_hint',
            hintType: 'prepare',
            text: ctx.text,
        }],
        priority: 10,
        terminal: true,
    },

    // ========================================================================
    // FACT CANDIDATES - Submission/presentation is externally observable
    // ========================================================================
    {
        id: 'submit-final-report',
        description: 'Submit final report (observable delivery)',
        pattern: /submit\s*final\s*report/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: DOCUMENT_SUBMITTED,
            payload: { documentType: 'final_report' },
            confidence: 'medium', // Still requires status confirmation ideally
        }],
        priority: 6,
    },
    {
        id: 'present-ppap',
        description: 'Present PPAP/DPAP to city (observable)',
        pattern: /present\s*(ppap|dpap)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: DOCUMENT_SUBMITTED,
            payload: {
                documentType: ctx.text.toLowerCase().includes('dpap') ? 'dpap' : 'ppap',
                submittedTo: 'city',
            },
            confidence: 'medium',
        }],
        priority: 6,
    },
];
