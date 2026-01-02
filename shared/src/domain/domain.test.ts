/**
 * Domain Function Tests
 *
 * Unit tests for the core domain functions:
 * - getFieldState() - field visibility, editability, requiredness
 * - getMissingFieldsForEntity() - missing field detection
 * - canAdvancePhase() - phase progression eligibility
 * - resolveReference() - reference resolution
 */

import { describe, it, expect } from 'vitest';
import { getFieldState, getFieldStates } from './fieldVisibility';
import { isValueMissing, getMissingFieldsForEntity } from './completeness';
import { canAdvancePhase, getMaxReachablePhase } from './phaseProgression';
import { resolveReference } from './referenceResolution';
import type { FieldDefinition, ProjectState, EntityContext, Reference } from './types';

// ==================== TEST FIXTURES ====================

const createProjectState = (overrides: Partial<ProjectState> = {}): ProjectState => ({
    projectId: 'project-1',
    phase: 0,
    nodes: [],
    records: [],
    definitions: [],
    metadata: {},
    ...overrides,
});

const createField = (overrides: Partial<FieldDefinition> = {}): FieldDefinition => ({
    key: 'test-field',
    type: 'text',
    label: 'Test Field',
    ...overrides,
});

// ==================== getFieldState TESTS ====================

describe('getFieldState', () => {
    it('returns visible and editable for basic field', () => {
        const field = createField({ key: 'title' });
        const projectState = createProjectState();

        const state = getFieldState(field, projectState);

        expect(state.visible).toBe(true);
        expect(state.editable).toBe(true);
        expect(state.required).toBe(false);
    });

    it('returns required=true when field.required is true', () => {
        const field = createField({ key: 'title', required: true });
        const projectState = createProjectState();

        const state = getFieldState(field, projectState);

        expect(state.required).toBe(true);
    });

    it('hides deprecated fields', () => {
        const field = createField({ key: 'old-field', deprecated: true });
        const projectState = createProjectState();

        const state = getFieldState(field, projectState);

        expect(state.visible).toBe(false);
        expect(state.editable).toBe(false);
        expect(state.reason).toBe('Field is deprecated');
    });

    it('hides fields when project phase is below field phase', () => {
        const field = createField({ key: 'phase-2-field', phase: 2 });
        const projectState = createProjectState({ phase: 0 });

        const state = getFieldState(field, projectState);

        expect(state.visible).toBe(false);
        expect(state.editable).toBe(false);
        expect(state.reason).toContain('phase');
    });

    it('shows fields when project phase equals field phase', () => {
        const field = createField({ key: 'phase-2-field', phase: 2 });
        const projectState = createProjectState({ phase: 2 });

        const state = getFieldState(field, projectState);

        expect(state.visible).toBe(true);
        expect(state.editable).toBe(true);
    });

    it('shows fields when project phase exceeds field phase', () => {
        const field = createField({ key: 'phase-1-field', phase: 1 });
        const projectState = createProjectState({ phase: 3 });

        const state = getFieldState(field, projectState);

        expect(state.visible).toBe(true);
        expect(state.editable).toBe(true);
    });

    it('makes required fields required when phase is reached', () => {
        const field = createField({ key: 'phase-1-field', phase: 1, required: true });
        const projectState = createProjectState({ phase: 1 });

        const state = getFieldState(field, projectState);

        expect(state.required).toBe(true);
    });

    it('returns states for multiple fields', () => {
        const fields = [
            createField({ key: 'visible-field' }),
            createField({ key: 'hidden-field', phase: 5 }),
            createField({ key: 'deprecated-field', deprecated: true }),
        ];
        const projectState = createProjectState({ phase: 0 });

        const states = getFieldStates(fields, projectState);

        expect(states.get('visible-field')?.visible).toBe(true);
        expect(states.get('hidden-field')?.visible).toBe(false);
        expect(states.get('deprecated-field')?.visible).toBe(false);
    });
});

// ==================== isValueMissing TESTS ====================

describe('isValueMissing', () => {
    it('returns true for null', () => {
        expect(isValueMissing(null, 'text')).toBe(true);
    });

    it('returns true for undefined', () => {
        expect(isValueMissing(undefined, 'text')).toBe(true);
    });

    it('returns true for empty string in text field', () => {
        expect(isValueMissing('', 'text')).toBe(true);
        expect(isValueMissing('  ', 'text')).toBe(true);
    });

    it('returns false for non-empty string', () => {
        expect(isValueMissing('hello', 'text')).toBe(false);
    });

    it('returns true for empty array in tags field', () => {
        expect(isValueMissing([], 'tags')).toBe(true);
    });

    it('returns false for non-empty array', () => {
        expect(isValueMissing(['tag1'], 'tags')).toBe(false);
    });

    it('returns false for zero in number field', () => {
        expect(isValueMissing(0, 'number')).toBe(false);
    });

    it('returns false for zero in percent field', () => {
        expect(isValueMissing(0, 'percent')).toBe(false);
    });
});

// ==================== getMissingFieldsForEntity TESTS ====================

describe('getMissingFieldsForEntity', () => {
    it('returns empty for complete data', () => {
        const fields = [
            createField({ key: 'title', required: true }),
            createField({ key: 'description', required: true }),
        ];
        const data = { title: 'My Title', description: 'My Description' };
        const projectState = createProjectState();

        const missing = getMissingFieldsForEntity(fields, data, projectState);

        expect(missing).toHaveLength(0);
    });

    it('returns missing required fields', () => {
        const fields = [
            createField({ key: 'title', required: true, label: 'Title' }),
            createField({ key: 'description', required: true, label: 'Description' }),
        ];
        const data = { title: 'My Title' }; // missing description
        const projectState = createProjectState();

        const missing = getMissingFieldsForEntity(fields, data, projectState);

        expect(missing).toHaveLength(1);
        expect(missing[0].fieldId).toBe('description');
        expect(missing[0].label).toBe('Description');
        expect(missing[0].severity).toBe('blocking');
    });

    it('ignores non-required fields', () => {
        const fields = [
            createField({ key: 'title', required: true }),
            createField({ key: 'notes', required: false }),
        ];
        const data = { title: 'My Title' }; // notes is not required
        const projectState = createProjectState();

        const missing = getMissingFieldsForEntity(fields, data, projectState);

        expect(missing).toHaveLength(0);
    });

    it('ignores invisible fields', () => {
        const fields = [
            createField({ key: 'title', required: true }),
            createField({ key: 'future-field', required: true, phase: 5 }),
        ];
        const data = { title: 'My Title' }; // future-field not visible yet
        const projectState = createProjectState({ phase: 0 });

        const missing = getMissingFieldsForEntity(fields, data, projectState);

        expect(missing).toHaveLength(0);
    });

    it('includes entity context in missing field', () => {
        const fields = [createField({ key: 'title', required: true })];
        const data = {};
        const projectState = createProjectState();
        const entityContext: EntityContext = { entityId: 'rec-123', entityType: 'record' };

        const missing = getMissingFieldsForEntity(fields, data, projectState, entityContext);

        expect(missing[0].entityId).toBe('rec-123');
        expect(missing[0].entityType).toBe('record');
    });
});

// ==================== canAdvancePhase TESTS ====================

describe('canAdvancePhase', () => {
    it('allows advancement when no blockers', () => {
        const projectState = createProjectState({
            phase: 0,
            nodes: [],
            records: [],
            definitions: [],
        });

        const result = canAdvancePhase(0, projectState);

        expect(result.allowed).toBe(true);
        expect(result.blockers).toHaveLength(0);
    });

    it('blocks advancement when required fields are missing', () => {
        // Create a project state with a record that has missing required fields
        const projectState = createProjectState({
            phase: 0,
            records: [
                { id: 'rec-1', definition_id: 'def-1', unique_name: 'record1', data: {} },
            ],
            definitions: [
                {
                    id: 'def-1',
                    name: 'Test Definition',
                    schema_config: {
                        fields: [{ key: 'title', type: 'text', label: 'Title', required: true, phase: 0 }],
                    },
                },
            ],
        });

        const result = canAdvancePhase(0, projectState);

        expect(result.allowed).toBe(false);
        expect(result.blockers.length).toBeGreaterThan(0);
    });
});

// ==================== getMaxReachablePhase TESTS ====================

describe('getMaxReachablePhase', () => {
    it('returns max phase when all phases are complete', () => {
        const projectState = createProjectState({
            phase: 0,
            records: [],
            definitions: [],
        });

        const maxPhase = getMaxReachablePhase(projectState, 5);

        expect(maxPhase).toBe(4); // 0-indexed, so max is 4 for 5 phases
    });
});

// ==================== resolveReference TESTS ====================

describe('resolveReference', () => {
    it('returns broken status when target does not exist', () => {
        const reference: Reference = {
            referenceId: 'ref-1',
            sourceField: 'link',
            targetId: 'nonexistent-id',
            mode: 'dynamic',
        };
        const projectState = createProjectState({
            nodes: [],
            records: [],
        });

        const resolved = resolveReference(reference, projectState);

        expect(resolved.status).toBe('broken');
        expect(resolved.reason).toContain('no longer exists');
    });

    it('returns dynamic status for dynamic reference with existing target', () => {
        const reference: Reference = {
            referenceId: 'ref-1',
            sourceField: 'link',
            targetId: 'node-1',
            mode: 'dynamic',
        };
        const projectState = createProjectState({
            nodes: [{ id: 'node-1', title: 'Test Node', type: 'task' }],
        });

        const resolved = resolveReference(reference, projectState);

        expect(resolved.status).toBe('dynamic');
        expect(resolved.value).toBe('Test Node');
    });

    it('returns static status for static reference with existing target', () => {
        const reference: Reference = {
            referenceId: 'ref-1',
            sourceField: 'link',
            targetId: 'rec-1',
            mode: 'static',
        };
        const projectState = createProjectState({
            records: [{ id: 'rec-1', unique_name: 'my-record' }],
        });

        const resolved = resolveReference(reference, projectState);

        expect(resolved.status).toBe('static');
        expect(resolved.value).toBe('my-record');
    });
});
