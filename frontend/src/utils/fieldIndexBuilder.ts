import type {
    RecordDefinition,
    FieldDef,
} from '../types';
import type {
    FieldIndex,
    FieldCategory,
    FieldDescriptor
} from '@autoart/shared';

/**
 * Generates a FieldIndex structure from RecordDefinitions.
 * Currently organizes by Definition Source (System vs Project) -> Definition -> Fields.
 */
export function generateFieldIndex(
    definitions: RecordDefinition[],
    projectId?: string | null
): FieldIndex {
    
    const systemDefinitions = definitions.filter(d => d.is_system);
    const customDefinitions = definitions.filter(d => !d.is_system);

    const categories: FieldCategory[] = [];

    // 1. System Definitions Category
    if (systemDefinitions.length > 0) {
        categories.push({
            id: 'cat-system',
            name: 'System Records',
            label: 'System Records',
            icon: 'Settings', // Lucide icon name
            childCount: systemDefinitions.length,
            subcategories: systemDefinitions.map(def => createDefinitionCategory(def)),
            fields: []
        });
    }

    // 2. Project/Custom Definitions Category
    if (customDefinitions.length > 0) {
        categories.push({
            id: 'cat-custom',
            name: 'Custom Records',
            label: 'Custom Records',
            icon: 'FileJson',
            childCount: customDefinitions.length,
            subcategories: customDefinitions.map(def => createDefinitionCategory(def)),
            fields: []
        });
    }

    // Calculate totals
    let totalFields = 0;
    categories.forEach(c => {
        c.subcategories?.forEach(sub => {
            totalFields += sub.fields?.length || 0;
        });
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
