/**
 * @autoart/shared - Field View Model
 *
 * Factory functions for building FieldViewModels from domain state.
 *
 * RULE: FieldViewModel is the sole input to field rendering components.
 * RULE: Composites build these; molecules/atoms only consume.
 * RULE: Frontend imports and uses; does not redefine.
 */

import type {
    FieldViewModel,
    FieldDefinition,
    ProjectState,
    EntityContext,
} from './types.js';
import { getFieldState } from './fieldVisibility.js';
import { isValueMissing } from './completeness.js';

// ==================== FIELD VIEW MODEL FACTORY ====================

/**
 * Options for building a FieldViewModel.
 */
export interface BuildFieldViewModelOptions {
    /** The field definition */
    field: FieldDefinition;

    /** The current value of the field */
    value: unknown;

    /** The project state for computing visibility/editability */
    projectState: ProjectState;

    /** Context about the entity being edited */
    entityContext?: EntityContext;

    /** Validation error (if any) */
    error?: string;

    /** Override for placeholder text */
    placeholder?: string;

    /** Override for help text */
    helpText?: string;
}

/**
 * Builds a FieldViewModel from a field definition and current value.
 *
 * @param options - The build options
 * @returns A complete FieldViewModel ready for rendering
 */
export function buildFieldViewModel(options: BuildFieldViewModelOptions): FieldViewModel {
    const {
        field,
        value,
        projectState,
        entityContext,
        error,
        placeholder,
        helpText,
    } = options;

    // Get computed field state
    const state = getFieldState(field, projectState, entityContext);

    // Check if value is missing (for showing required indicator)
    const isMissing = state.required && isValueMissing(value, field.type);

    return {
        fieldId: field.key,
        label: field.label,
        value,
        type: field.type,
        visible: state.visible,
        editable: state.editable,
        required: state.required,
        error: error ?? (isMissing ? 'This field is required' : undefined),
        options: field.options,
        placeholder: placeholder ?? getDefaultPlaceholder(field),
        helpText: helpText ?? state.reason,
        width: (field as FieldDefinition & { width?: number | 'flex' }).width,
    };
}

/**
 * Builds FieldViewModels for multiple fields at once.
 *
 * @param fields - Array of field definitions
 * @param data - The entity's data (record.data or node.metadata)
 * @param projectState - The project state
 * @param entityContext - Context about the entity
 * @param errors - Map of fieldId to error message
 * @returns Array of FieldViewModels
 */
export function buildFieldViewModels(
    fields: FieldDefinition[],
    data: Record<string, unknown>,
    projectState: ProjectState,
    entityContext?: EntityContext,
    errors?: Record<string, string>
): FieldViewModel[] {
    return fields.map((field) =>
        buildFieldViewModel({
            field,
            value: data[field.key],
            projectState,
            entityContext,
            error: errors?.[field.key],
        })
    );
}

/**
 * Filters FieldViewModels to only visible ones.
 *
 * @param viewModels - Array of FieldViewModels
 * @returns Filtered array with only visible fields
 */
export function filterVisibleViewModels(viewModels: FieldViewModel[]): FieldViewModel[] {
    return viewModels.filter((vm) => vm.visible);
}

/**
 * Groups FieldViewModels by category.
 *
 * @param viewModels - Array of FieldViewModels
 * @param fields - Original field definitions (for category info)
 * @returns Map of category to FieldViewModels
 */
export function groupViewModelsByCategory(
    viewModels: FieldViewModel[],
    fields: FieldDefinition[]
): Map<string, FieldViewModel[]> {
    const groups = new Map<string, FieldViewModel[]>();
    const fieldMap = new Map(fields.map((f) => [f.key, f]));

    for (const vm of viewModels) {
        const field = fieldMap.get(vm.fieldId);
        const category = field?.category ?? 'General';

        if (!groups.has(category)) {
            groups.set(category, []);
        }
        groups.get(category)!.push(vm);
    }

    return groups;
}

/**
 * Creates an empty FieldViewModel for a new field.
 *
 * @param field - The field definition
 * @returns A FieldViewModel with default/empty values
 */
export function createEmptyFieldViewModel(field: FieldDefinition): FieldViewModel {
    return {
        fieldId: field.key,
        label: field.label,
        value: field.defaultValue ?? getDefaultValue(field.type),
        type: field.type,
        visible: true,
        editable: true,
        required: field.required ?? false,
        options: field.options,
        placeholder: getDefaultPlaceholder(field),
    };
}

// ==================== HELPERS ====================

/**
 * Gets the default placeholder text for a field type.
 */
function getDefaultPlaceholder(field: FieldDefinition): string {
    switch (field.type) {
        case 'text':
            return `Enter ${field.label.toLowerCase()}...`;
        case 'textarea':
            return `Enter ${field.label.toLowerCase()}...`;
        case 'number':
            return '0';
        case 'percent':
            return '0%';
        case 'date':
            return 'Select date...';
        case 'select':
        case 'status':
            return `Select ${field.label.toLowerCase()}...`;
        case 'user':
            return 'Select user...';
        case 'tags':
            return 'Add tags...';
        default:
            return '';
    }
}

/**
 * Gets the default value for a field type.
 */
function getDefaultValue(type: string): unknown {
    switch (type) {
        case 'text':
        case 'textarea':
            return '';
        case 'number':
        case 'percent':
            return null;
        case 'date':
            return null;
        case 'select':
        case 'status':
            return null;
        case 'user':
            return null;
        case 'tags':
            return [];
        case 'checkbox':
            return false;
        default:
            return null;
    }
}
