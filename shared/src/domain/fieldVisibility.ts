/**
 * @autoart/shared - Field Visibility
 *
 * Domain logic for determining field visibility, editability, and requiredness.
 *
 * RULE: No UI components compute field rules - they use these functions.
 * RULE: Backend validation must derive from the same logic.
 */

import type {
    FieldState,
    FieldDefinition,
    ProjectState,
    EntityContext,
} from './types.js';

// ==================== FIELD STATE RESOLUTION ====================

/**
 * Computes the visibility, editability, and requiredness of a field.
 *
 * @param field - The field definition
 * @param projectState - The current project state
 * @param entityContext - Context about the entity being edited
 * @returns The computed field state
 */
export function getFieldState(
    field: FieldDefinition,
    projectState: ProjectState,
    entityContext?: EntityContext
): FieldState {
    const fieldId = field.key;

    // Default state
    let visible = true;
    let editable = true;
    let required = field.required ?? false;
    let reason: string | undefined;

    // Rule 1: Deprecated fields are hidden and not editable
    if (field.deprecated) {
        return {
            fieldId,
            visible: false,
            editable: false,
            required: false,
            reason: 'Field is deprecated',
        };
    }

    // Rule 2: Phase-based visibility
    if (field.phase !== undefined && field.phase > projectState.phase) {
        visible = false;
        editable = false;
        reason = `Field available in phase ${field.phase + 1}`;
    }

    // Rule 3: Phase-based requiredness
    // Fields become required when the project reaches or passes their phase
    if (field.phase !== undefined && field.phase <= projectState.phase) {
        if (field.required) {
            required = true;
            reason = reason ?? `Required for phase ${field.phase + 1}`;
        }
    }

    // Rule 4: Entity-specific overrides
    if (entityContext) {
        // Tasks have different visibility rules than other nodes
        if (entityContext.nodeType === 'task') {
            // Tasks are always editable while in progress
            editable = true;
        }

        // Project-level nodes might have restricted editing
        if (entityContext.nodeType === 'project') {
            // Some fields on projects are only editable by owners
            // This would check projectState.metadata.ownerId against current user
            // For now, we assume editable
        }
    }

    return {
        fieldId,
        visible,
        editable,
        required,
        reason,
    };
}

/**
 * Computes field states for multiple fields at once.
 *
 * @param fields - Array of field definitions
 * @param projectState - The current project state
 * @param entityContext - Context about the entity being edited
 * @returns Map of fieldId to FieldState
 */
export function getFieldStates(
    fields: FieldDefinition[],
    projectState: ProjectState,
    entityContext?: EntityContext
): Map<string, FieldState> {
    const states = new Map<string, FieldState>();

    for (const field of fields) {
        states.set(field.key, getFieldState(field, projectState, entityContext));
    }

    return states;
}

/**
 * Filters fields to only those that are visible.
 *
 * @param fields - Array of field definitions
 * @param projectState - The current project state
 * @param entityContext - Context about the entity being edited
 * @returns Array of visible field definitions
 */
export function getVisibleFields(
    fields: FieldDefinition[],
    projectState: ProjectState,
    entityContext?: EntityContext
): FieldDefinition[] {
    return fields.filter((field) => {
        const state = getFieldState(field, projectState, entityContext);
        return state.visible;
    });
}

/**
 * Checks if a specific field is editable.
 *
 * @param field - The field definition
 * @param projectState - The current project state
 * @param entityContext - Context about the entity being edited
 * @returns Whether the field can be edited
 */
export function isFieldEditable(
    field: FieldDefinition,
    projectState: ProjectState,
    entityContext?: EntityContext
): boolean {
    const state = getFieldState(field, projectState, entityContext);
    return state.visible && state.editable;
}

/**
 * Gets all required fields for the current phase.
 *
 * @param fields - Array of field definitions
 * @param projectState - The current project state
 * @returns Array of required field definitions
 */
export function getRequiredFields(
    fields: FieldDefinition[],
    projectState: ProjectState
): FieldDefinition[] {
    return fields.filter((field) => {
        const state = getFieldState(field, projectState);
        return state.visible && state.required;
    });
}
