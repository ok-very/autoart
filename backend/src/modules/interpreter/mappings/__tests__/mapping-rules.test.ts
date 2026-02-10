import { describe, it, expect } from 'vitest';
import { applyMappingRules } from '../types.js';
import { artworkMappingRules } from '../artwork-rules.js';
import { budgetMappingRules } from '../budget-rules.js';
import { permitMappingRules } from '../permit-rules.js';
import { stageMappingRules } from '../stage-rules.js';
import { normalizeStage } from '../stage-rules.js';
import { defaultMappingRules } from '../index.js';

describe('artwork-rules', () => {
    it('"Selected Artist: Rebecca Bayer" → ARTWORK_SELECTED', () => {
        const outputs = applyMappingRules(
            { text: 'Selected Artist: Rebecca Bayer' },
            artworkMappingRules,
        );
        expect(outputs.length).toBeGreaterThanOrEqual(1);
        const fact = outputs.find(
            (o) => o.kind === 'fact_candidate' && o.factKind === 'ARTWORK_SELECTED',
        );
        expect(fact).toBeDefined();
        expect(fact!.kind === 'fact_candidate' && fact!.payload?.artistName).toBe('Rebecca Bayer');
    });

    it('"Shortlisted Artists: Angie Quintanilla-Coates, Mustaali Raj" → ARTWORK_INITIATED', () => {
        const outputs = applyMappingRules(
            { text: 'Shortlisted Artists: Angie Quintanilla-Coates, Mustaali Raj' },
            artworkMappingRules,
        );
        const fact = outputs.find(
            (o) => o.kind === 'fact_candidate' && o.factKind === 'ARTWORK_INITIATED',
        );
        expect(fact).toBeDefined();
    });

    it('"25% Fabrication" → ARTWORK_FABRICATED with progress 25', () => {
        const outputs = applyMappingRules(
            { text: '25% Fabrication' },
            artworkMappingRules,
        );
        const fact = outputs.find(
            (o) => o.kind === 'fact_candidate' && o.factKind === 'ARTWORK_FABRICATED',
        );
        expect(fact).toBeDefined();
        expect(fact!.kind === 'fact_candidate' && fact!.payload?.progress).toBe(25);
    });

    it('"fabrication has started" → ARTWORK_FABRICATED with progress 0', () => {
        const outputs = applyMappingRules(
            { text: 'fabrication has started' },
            artworkMappingRules,
        );
        const fact = outputs.find(
            (o) => o.kind === 'fact_candidate' && o.factKind === 'ARTWORK_FABRICATED',
        );
        expect(fact).toBeDefined();
        expect(fact!.kind === 'fact_candidate' && fact!.payload?.progress).toBe(0);
    });
});

describe('budget-rules', () => {
    it('"(Art: $265,000 | Total: $375,402.06)" → 2x BUDGET_ALLOCATED', () => {
        const outputs = applyMappingRules(
            { text: '(Art: $265,000 | Total: $375,402.06)' },
            budgetMappingRules,
        );
        const budgetFacts = outputs.filter(
            (o) => o.kind === 'fact_candidate' && o.factKind === 'BUDGET_ALLOCATED',
        );
        expect(budgetFacts).toHaveLength(2);

        const artFact = budgetFacts.find(
            (o) => o.kind === 'fact_candidate' && o.payload?.allocationType === 'artwork',
        );
        expect(artFact).toBeDefined();
        expect(artFact!.kind === 'fact_candidate' && artFact!.payload?.amount).toBe(265000);

        const totalFact = budgetFacts.find(
            (o) => o.kind === 'fact_candidate' && o.payload?.allocationType === 'total',
        );
        expect(totalFact).toBeDefined();
        expect(totalFact!.kind === 'fact_candidate' && totalFact!.payload?.amount).toBe(375402.06);
    });
});

describe('permit-rules', () => {
    it('"PAC presentation" → MILESTONE_ACHIEVED with PAC type', () => {
        const outputs = applyMappingRules(
            { text: 'PAC presentation' },
            permitMappingRules,
        );
        const fact = outputs.find(
            (o) => o.kind === 'fact_candidate' && o.factKind === 'MILESTONE_ACHIEVED',
        );
        expect(fact).toBeDefined();
        expect(fact!.kind === 'fact_candidate' && fact!.payload?.milestoneType).toBe('PAC');
    });

    it('"LOC due prior to BP Issuance" → action_hint', () => {
        const outputs = applyMappingRules(
            { text: 'LOC due prior to BP Issuance' },
            permitMappingRules,
        );
        const hint = outputs.find((o) => o.kind === 'action_hint');
        expect(hint).toBeDefined();
        expect(hint!.kind === 'action_hint' && hint!.hintType).toBe('prepare');
    });
});

describe('stage-rules', () => {
    it('"on hold" → STAGE_ENTERED with On Hold', () => {
        const outputs = applyMappingRules(
            { text: 'on hold' },
            stageMappingRules,
        );
        const fact = outputs.find(
            (o) => o.kind === 'fact_candidate' && o.factKind === 'STAGE_ENTERED',
        );
        expect(fact).toBeDefined();
        expect(fact!.kind === 'fact_candidate' && fact!.payload?.stageName).toBe('On Hold');
    });

    it('normalizeStage resolves all 12 canonical phases', () => {
        const canonicalPhases = [
            '1. Project Initiation',
            '2. PPAP',
            '3. DPAP',
            '4.1. Artist Selection SP#1',
            '4.2. Artist Selection SP#2',
            '5. Artist Contract',
            '6. Detailed Design',
            '7. Fabrication Start',
            '8. 50% Fabrication',
            '9. 100% Fabrication/Install',
            '10. Final Documents',
            '11. Photo',
        ];

        // Each canonical phase should resolve to itself via its lowercase form
        for (const phase of canonicalPhases) {
            const result = normalizeStage(phase);
            expect(result).toBe(phase);
        }
    });

    it('normalizeStage maps common aliases correctly', () => {
        expect(normalizeStage('planning')).toBe('1. Project Initiation');
        expect(normalizeStage('ppap')).toBe('2. PPAP');
        expect(normalizeStage('dpap')).toBe('3. DPAP');
        expect(normalizeStage('selection')).toBe('4.1. Artist Selection SP#1');
        expect(normalizeStage('sp#2')).toBe('4.2. Artist Selection SP#2');
        expect(normalizeStage('design')).toBe('6. Detailed Design');
        expect(normalizeStage('fabrication')).toBe('7. Fabrication Start');
        expect(normalizeStage('install')).toBe('9. 100% Fabrication/Install');
        expect(normalizeStage('complete')).toBe('10. Final Documents');
        expect(normalizeStage('photo')).toBe('11. Photo');
        expect(normalizeStage('tbc')).toBe('TBC');
    });

    it('"behind schedule" → field_value for schedule_status', () => {
        const outputs = applyMappingRules(
            { text: 'behind schedule' },
            stageMappingRules,
        );
        const field = outputs.find((o) => o.kind === 'field_value');
        expect(field).toBeDefined();
        expect(field!.kind === 'field_value' && field!.field).toBe('schedule_status');
        expect(field!.kind === 'field_value' && field!.value).toBe('behind_schedule');
    });
});

describe('terminal rule tiebreaker', () => {
    it('"installation complete" with full rule set → ARTWORK_INSTALLED wins over MILESTONE_ACHIEVED', () => {
        const outputs = applyMappingRules(
            { text: 'installation complete' },
            defaultMappingRules,
        );
        // With artwork before permit in spread order, and both at priority 11,
        // artwork's "installation-complete" rule fires first and is terminal
        const artworkFact = outputs.find(
            (o) => o.kind === 'fact_candidate' && o.factKind === 'ARTWORK_INSTALLED',
        );
        expect(artworkFact).toBeDefined();

        // MILESTONE_ACHIEVED should NOT fire because artwork rule is terminal
        const milestoneFact = outputs.find(
            (o) => o.kind === 'fact_candidate' && o.factKind === 'MILESTONE_ACHIEVED',
        );
        expect(milestoneFact).toBeUndefined();
    });
});
