/**
 * Document Mapping Rules
 *
 * Rules for interpreting CSV rows as DOCUMENT_PREPARED or DOCUMENT_SUBMITTED.
 * Captures: agendas, budgets, templates, reports, plans
 */

import type { MappingRule, MappingContext, MappingOutput } from './types.js';

const DOCUMENT_PREPARED = 'DOCUMENT_PREPARED';
const DOCUMENT_SUBMITTED = 'DOCUMENT_SUBMITTED';

export const documentMappingRules: MappingRule[] = [
    // Preparation patterns
    {
        id: 'prepare-agenda',
        description: 'Prepare/create meeting agenda',
        pattern: /(create|prepare|draft)\s*(meeting\s*)?agenda/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_PREPARED,
            payload: { documentType: 'agenda' },
            confidence: 'high',
        }],
        priority: 6,
    },
    {
        id: 'draft-checklist',
        description: 'Draft checklist',
        pattern: /draft\s*checklist/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_PREPARED,
            payload: { documentType: 'checklist' },
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'create-folder',
        description: 'Create project folder',
        pattern: /create\s*(project\s*)?folder/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_PREPARED,
            payload: { documentType: 'folder' },
            confidence: 'medium',
        }],
        priority: 4,
    },
    {
        id: 'setup-budget',
        description: 'Set up budget/invoice template',
        pattern: /set\s*up\s*(bfa\s*)?(master\s*)?budget|set\s*up\s*invoice\s*template/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_PREPARED,
            payload: { documentType: 'budget' },
            confidence: 'medium',
        }],
        priority: 4,
    },
    {
        id: 'prepare-proposal',
        description: 'Prepare written proposal',
        pattern: /prepare\s*(written\s*)?(fee\s*)?proposal/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_PREPARED,
            payload: { documentType: 'fee_proposal' },
            confidence: 'high',
        }],
        priority: 5,
    },
    {
        id: 'write-section',
        description: 'Write public art opportunity/selection process',
        pattern: /write\s*(public\s*art\s*opportunity|selection\s*process)/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_PREPARED,
            payload: { documentType: 'ppap_section' },
            confidence: 'medium',
        }],
        priority: 4,
    },
    {
        id: 'create-document',
        description: 'Create voting table/tearsheets/thumbnails',
        pattern: /create\s*(voting\s*table|indesign\s*document|thumbnail\s*sheet)/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_PREPARED,
            payload: { documentType: 'document' },
            confidence: 'medium',
        }],
        priority: 4,
    },
    {
        id: 'fill-template',
        description: 'Fill out template (plaque, stat dec)',
        pattern: /fill\s*(out\s*)?(plaque|stat\s*dec)\s*template/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_PREPARED,
            payload: { documentType: 'template' },
            confidence: 'medium',
        }],
        priority: 4,
    },
    {
        id: 'draft-legal',
        description: 'Draft legal documents (AA, ToT)',
        pattern: /draft\s*(aa|tot|letter\s*of\s*acceptance|transfer\s*of\s*title)/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_PREPARED,
            payload: { documentType: 'legal_document' },
            confidence: 'high',
        }],
        priority: 5,
    },

    // Submission patterns
    {
        id: 'submit-final-report',
        description: 'Submit final report',
        pattern: /submit\s*final\s*report/i,
        emits: (): MappingOutput[] => [{
            factKind: DOCUMENT_SUBMITTED,
            payload: { documentType: 'final_report' },
            confidence: 'high',
        }],
        priority: 6,
    },
    {
        id: 'present-ppap',
        description: 'Present PPAP/DPAP to city',
        pattern: /present\s*(ppap|dpap)/i,
        emits: (ctx: MappingContext): MappingOutput[] => [{
            factKind: DOCUMENT_SUBMITTED,
            payload: {
                documentType: ctx.text.toLowerCase().includes('dpap') ? 'dpap' : 'ppap',
                submittedTo: 'city',
            },
            confidence: 'high',
        }],
        priority: 6,
    },
];
