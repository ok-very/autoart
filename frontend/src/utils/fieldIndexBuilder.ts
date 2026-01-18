import type {
    FieldIndex,
    FieldCategory,
    FieldDescriptor
} from '@autoart/shared';

import type {
    RecordDefinition,
    FieldDef,
} from '../types';

/**
 * Generates a FieldIndex structure from RecordDefinitions.
 * Currently organizes by Definition Source (System vs Project) -> Definition -> Fields.
 */
export function generateFieldIndex(
    definitions: RecordDefinition[],
    projectId?: string | null
): FieldIndex {

    // Filter out system definitions - we only care about custom/project definitions now
    const customDefinitions = definitions.filter(d => !d.is_system);

    // Create a single flat list of definition subcategories (no category grouping)
    const categories: FieldCategory[] = customDefinitions.map(def => createDefinitionCategory(def));

    // Calculate totals
    let totalFields = 0;
    categories.forEach(c => {
        totalFields += c.fields?.length || 0;
    });

    return {
        projectId: projectId || null,
        generatedAt: new Date().toISOString(),
        categories,
        totalFields,
        totalOccurrences: 0 // Placeholder until we scan data
    };
}


function createDefinitionCategory(def: RecordDefinition): FieldCategory {
    const fields = def.schema_config.fields.map(f => createFieldDescriptor(def, f));

    return {
        id: `def-${def.id}`,
        name: def.name,
        label: def.name,
        icon: def.styling.icon || 'File',
        childCount: fields.length,
        subcategories: [], // Leaf categories (definitions) don't have subcats in this view
        fields: fields
    };
}

function createFieldDescriptor(def: RecordDefinition, field: FieldDef): FieldDescriptor {
    return {
        id: `${def.id}:${field.key}`,
        path: `${def.name}.${field.key}`,
        label: field.label,
        type: field.type,
        sourceNodeType: null,
        sourceDefinitionName: def.name,
        sourceDefinitionId: def.id,
        sourceNodeIds: [],
        cardinality: 'single',
        occurrenceCount: 0,
        fieldKey: field.key,
        options: field.options
    };
}
