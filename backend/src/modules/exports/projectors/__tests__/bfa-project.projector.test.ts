import { describe, it, expect } from 'vitest';

import { _testing } from '../bfa-project.projector.js';

const {
    buildBudgets,
    deriveCurrentStage,
    buildSelectionPanelBlock,
    formatMilestones,
    formatNextSteps,
    formatCurrency,
    deriveCategory,
} = _testing;

// ============================================================================
// buildBudgets
// ============================================================================

describe('buildBudgets', () => {
    it('returns empty when no metadata and no events', () => {
        const result = buildBudgets([], null);
        expect(result).toEqual({});
    });

    it('reads artwork and total from metadata', () => {
        const result = buildBudgets([], { artwork_budget: 500000, total_budget: 650000 });
        expect(result.artwork?.numeric).toBe(500000);
        expect(result.total?.numeric).toBe(650000);
    });

    it('events override metadata (most recent wins)', () => {
        const events = [
            { payload: { allocationType: 'artwork', amount: 300000, currency: 'CAD' } },
        ];
        const result = buildBudgets(events, { artwork_budget: 500000 });
        expect(result.artwork?.numeric).toBe(300000);
    });

    it('generic "budget" allocationType slots into total', () => {
        const events = [
            { payload: { allocationType: 'budget', amount: 750000, currency: 'CAD' } },
        ];
        const result = buildBudgets(events, null);
        expect(result.total?.numeric).toBe(750000);
        expect(result.artwork).toBeUndefined();
    });

    it('handles both artwork and total events', () => {
        const events = [
            { payload: { allocationType: 'artwork', amount: 200000, currency: 'CAD' } },
            { payload: { allocationType: 'total', amount: 800000, currency: 'CAD' } },
        ];
        const result = buildBudgets(events, null);
        expect(result.artwork?.numeric).toBe(200000);
        expect(result.total?.numeric).toBe(800000);
    });

    it('ignores unknown allocationType', () => {
        const events = [
            { payload: { allocationType: 'misc', amount: 100000, currency: 'CAD' } },
        ];
        const result = buildBudgets(events, null);
        expect(result.artwork).toBeUndefined();
        expect(result.total).toBeUndefined();
    });
});

// ============================================================================
// deriveCurrentStage
// ============================================================================

describe('deriveCurrentStage', () => {
    it('returns undefined for no events', () => {
        expect(deriveCurrentStage([])).toBeUndefined();
    });

    it('returns canonical phase name from most recent event', () => {
        const events = [
            { payload: { stageName: '6. Detailed Design' } },
            { payload: { stageName: '3. Schematic Design' } },
        ];
        expect(deriveCurrentStage(events)).toBe('6. Detailed Design');
    });

    it('returns undefined if stageName is empty string', () => {
        const events = [{ payload: { stageName: '' } }];
        expect(deriveCurrentStage(events)).toBeUndefined();
    });

    it('returns undefined if stageName missing from payload', () => {
        const events = [{ payload: {} }];
        expect(deriveCurrentStage(events)).toBeUndefined();
    });
});

// ============================================================================
// buildSelectionPanelBlock
// ============================================================================

describe('buildSelectionPanelBlock', () => {
    it('returns empty block when no panels', () => {
        const result = buildSelectionPanelBlock([]);
        expect(result.members).toEqual([]);
        expect(result.shortlist).toEqual([]);
        expect(result.alternates).toEqual([]);
        expect(result.selectedArtist).toBeUndefined();
    });

    it('extracts members, shortlist, and selected artist', () => {
        const panels = [{
            data: {
                meeting_type: 'SP#1',
                members: 'Alice, Bob',
                shortlisted_artists: 'Artist A, Artist B',
                selected_artist: 'Artist A',
                artwork_title: 'Untitled',
            },
        }];
        const result = buildSelectionPanelBlock(panels);
        expect(result.members).toEqual(['Alice', 'Bob']);
        expect(result.shortlist).toEqual(['Artist A', 'Artist B']);
        expect(result.selectedArtist).toBe('Artist A');
        expect(result.artworkTitle).toBe('Untitled');
    });

    it('prefers SP#2 data over SP#1', () => {
        const panels = [
            { data: { meeting_type: 'SP#1', selected_artist: 'From SP1' } },
            { data: { meeting_type: 'SP#2', selected_artist: 'From SP2' } },
        ];
        const result = buildSelectionPanelBlock(panels);
        expect(result.selectedArtist).toBe('From SP2');
    });

    it('handles null data', () => {
        const result = buildSelectionPanelBlock([{ data: null }]);
        expect(result.members).toEqual([]);
    });
});

// ============================================================================
// formatMilestones
// ============================================================================

describe('formatMilestones', () => {
    it('returns empty array for no milestones', () => {
        expect(formatMilestones([])).toEqual([]);
    });

    it('formats completed milestone', () => {
        const milestones = [{
            data: {
                milestone_type: 'PPAP',
                target_date: '2025-03-15',
                actual_date: '2025-03-10',
                status: 'Completed',
            },
        }];
        const result = formatMilestones(milestones);
        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe('PPAP');
        expect(result[0].status).toBe('completed');
    });

    it('formats scheduled milestone with future date', () => {
        const milestones = [{
            data: {
                milestone_type: 'DPAP',
                target_date: '2099-12-01',
            },
        }];
        const result = formatMilestones(milestones);
        expect(result[0].status).toBe('scheduled');
    });

    it('falls back to name if milestone_type missing', () => {
        const milestones = [{ data: { name: 'Install' } }];
        const result = formatMilestones(milestones);
        expect(result[0].kind).toBe('Install');
    });

    it('handles null data', () => {
        const result = formatMilestones([{ data: null }]);
        expect(result[0].kind).toBe('Unknown');
    });
});

// ============================================================================
// formatNextSteps
// ============================================================================

describe('formatNextSteps', () => {
    it('returns empty array for no tasks', () => {
        expect(formatNextSteps([])).toEqual([]);
    });

    it('formats open task', () => {
        const tasks = [{ title: 'Submit documents', metadata: { status: 'pending', assignee: 'BFA' } }];
        const result = formatNextSteps(tasks);
        expect(result[0].text).toBe('Submit documents');
        expect(result[0].completed).toBe(false);
        expect(result[0].assigneeHint).toBe('BFA');
    });

    it('detects completed status variants', () => {
        for (const status of ['done', 'Complete', 'FINISHED', 'marked as done']) {
            const tasks = [{ title: 'Task', metadata: { status } }];
            const result = formatNextSteps(tasks);
            expect(result[0].completed).toBe(true);
        }
    });

    it('handles null metadata', () => {
        const tasks = [{ title: 'Something', metadata: null }];
        const result = formatNextSteps(tasks);
        expect(result[0].completed).toBe(false);
        expect(result[0].assigneeHint).toBeUndefined();
    });
});

// ============================================================================
// formatCurrency
// ============================================================================

describe('formatCurrency', () => {
    it('formats number as CAD by default', () => {
        const result = formatCurrency(500000);
        expect(result).toContain('500,000');
        expect(result).toContain('$');
    });

    it('parses string amounts', () => {
        const result = formatCurrency('650000');
        expect(result).toContain('650,000');
    });

    it('returns empty string for null/undefined', () => {
        expect(formatCurrency(null)).toBe('');
        expect(formatCurrency(undefined)).toBe('');
    });

    it('returns empty string for NaN', () => {
        expect(formatCurrency('not a number')).toBe('');
    });
});

// ============================================================================
// deriveCategory
// ============================================================================

describe('deriveCategory', () => {
    it('defaults to public when no metadata', () => {
        expect(deriveCategory(null)).toBe('public');
    });

    it('defaults to public when category empty', () => {
        expect(deriveCategory({ category: '' })).toBe('public');
    });

    it('returns corporate for corporate category', () => {
        expect(deriveCategory({ category: 'Corporate' })).toBe('corporate');
    });

    it('returns private_corporate for private corporate', () => {
        expect(deriveCategory({ category: 'Private Corporate' })).toBe('private_corporate');
    });

    it('returns public for non-corporate categories', () => {
        expect(deriveCategory({ category: 'Public Art' })).toBe('public');
    });
});
