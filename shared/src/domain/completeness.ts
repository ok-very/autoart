/**
 * @autoart/shared - Completeness
 *
 * Domain logic for computing missing fields and data completeness.
 *
 * RULE: This is the ONLY mechanism for determining "completeness".
 * RULE: Used by UI progress indicators, notifications, and export readiness.
 */

import type {
    MissingField,
    FieldDefinition,
    ProjectState,
    EntityContext,
} from './types';
import { getFieldState } from './fieldVisibility';

// ==================== MISSING FIELD DETECTION ====================

/**
 * Checks if a field value is considered "missing" or empty.
 *
 * @param value - The field value to check
 * @param fieldType - The type of field
 * @returns Whether the value is missing
 */
export function isValueMissing(value: unknown, fieldType: string): boolean {
    // Null or undefined is always missing
    if (value === null || value === undefined) {
        return true;
    }

    // Empty string is missing for text fields
    if (fieldType === 'text' || fieldType === 'textarea') {
        return typeof value === 'string' && value.trim() === '';
    }

    // Empty array is missing for tags/multi-select
    if (fieldType === 'tags' || fieldType === 'multiselect') {
        return Array.isArray(value) && value.length === 0;
    }

    // Zero is NOT missing for number fields (explicit zero is valid)
    if (fieldType === 'number' || fieldType === 'percent') {
        return false;
    }

    return false;
}

/**
 * Computes all missing fields for an entity.
 *
 * @param fields - Array of field definitions
 * @param data - The entity's data (record.data or node.metadata)
 * @param projectState - The current project state
 * @param entityContext - Context about the entity
 * @returns Array of missing fields
 */
export function getMissingFieldsForEntity(
    fields: FieldDefinition[],
    data: Record<string, unknown>,
    projectState: ProjectState,
    entityContext?: EntityContext
): MissingField[] {
    const missingFields: MissingField[] = [];

    for (const field of fields) {
        const state = getFieldState(field, projectState, entityContext);

        // Skip non-visible or non-required fields
        if (!state.visible || !state.required) {
            continue;
        }

        const value = data[field.key];
        const isMissing = isValueMissing(value, field.type);

        if (isMissing) {
            missingFields.push({
                fieldId: field.key,
                phase: field.phase ?? 0,
                severity: 'blocking',
                label: field.label,
                entityId: entityContext?.entityId,
                entityType: entityContext?.entityType,
            });
        }
    }

    return missingFields;
}

/**
 * Computes all missing fields across the entire project.
 *
 * @param projectState - The current project state
 * @returns Array of all missing fields in the project
 */
export function getMissingFields(projectState: ProjectState): MissingField[] {
    const allMissing: MissingField[] = [];

    // Check nodes (tasks, subprocesses, etc.)
    for (const node of projectState.nodes) {
        // Get the definition for this node type (if it exists)
        const definition = projectState.definitions.find(
            (d) => d.name.toLowerCase() === node.type.toLowerCase()
        );

        if (!definition) continue;

        const fields = definition.schema_config.fields as FieldDefinition[];
        const metadata = parseMetadata(node.metadata);

        const entityContext: EntityContext = {
            entityId: node.id,
            entityType: 'node',
            nodeType: node.type,
            parentId: node.parent_id ?? undefined,
        };

        const missing = getMissingFieldsForEntity(
            fields,
            metadata,
            projectState,
            entityContext
        );

        allMissing.push(...missing);
    }

    // Check records
    for (const record of projectState.records) {
        const definition = projectState.definitions.find(
            (d) => d.id === record.definition_id
        );

        if (!definition) continue;

        const fields = definition.schema_config.fields as FieldDefinition[];

        const entityContext: EntityContext = {
            entityId: record.id,
            entityType: 'record',
            definitionId: record.definition_id,
        };

        const missing = getMissingFieldsForEntity(
            fields,
            record.data,
            projectState,
            entityContext
        );

        allMissing.push(...missing);
    }

    return allMissing;
}

/**
 * Computes completeness percentage for an entity.
 *
 * @param fields - Array of field definitions
 * @param data - The entity's data
 * @param projectState - The current project state
 * @param entityContext - Context about the entity
 * @returns Percentage (0-100) of required fields that are complete
 */
export function getCompletenessPercentage(
    fields: FieldDefinition[],
    data: Record<string, unknown>,
    projectState: ProjectState,
    entityContext?: EntityContext
): number {
    const requiredFields = fields.filter((field) => {
        const state = getFieldState(field, projectState, entityContext);
        return state.visible && state.required;
    });

    if (requiredFields.length === 0) {
        return 100; // No required fields means 100% complete
    }

    const missingFields = getMissingFieldsForEntity(
        fields,
        data,
        projectState,
        entityContext
    );

    const completeCount = requiredFields.length - missingFields.length;
    return Math.round((completeCount / requiredFields.length) * 100);
}

/**
 * Counts blocking vs warning missing fields.
 *
 * @param missingFields - Array of missing fields
 * @returns Object with blocking and warning counts
 */
export function countMissingBySeverity(missingFields: MissingField[]): {
    blocking: number;
    warning: number;
} {
    let blocking = 0;
    let warning = 0;

    for (const field of missingFields) {
        if (field.severity === 'blocking') {
            blocking++;
        } else {
            warning++;
        }
    }

    return { blocking, warning };
}

// ==================== HELPERS ====================

/**
 * Safely parses node metadata from string or object.
 */
function parseMetadata(metadata: unknown): Record<string, unknown> {
    if (typeof metadata === 'string') {
        try {
            const parsed = JSON.parse(metadata);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    }
    return (metadata as Record<string, unknown>) ?? {};
}
