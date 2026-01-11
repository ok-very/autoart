/**
 * Monday.com Interpreter
 *
 * Translates Monday.com data nodes into ImportPlanItems.
 * Maps Monday columns to AutoArt fields using:
 * 1. Existing definition matches
 * 2. Learned user preferences
 * 3. Auto-inference from column types/names
 */

import type { MondayDataNode, MondayColumnValue } from '../imports/connectors/monday-connector.js';
import type { ImportPlanItem } from '../imports/types.js';
import { listDefinitions } from '../records/records.service.js';
import {
    getLearningsFor,
    applyLearnings,
    type ColumnMapping,
} from './inference-learner.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FieldRecording {
    fieldId?: string;
    fieldName: string;
    value: unknown;
    renderHint?: string;
}

// ============================================================================
// COLUMN TYPE MAPPING
// ============================================================================

/**
 * Map Monday column types to AutoArt RenderHints.
 * Source: Monday.com GraphQL API column type discovery.
 */
const MONDAY_TYPE_TO_RENDER_HINT: Record<string, string> = {
    // Core types
    name: 'text',
    text: 'text',
    long_text: 'longtext',
    status: 'status',
    date: 'date',
    people: 'person',
    numbers: 'number',

    // Selection types
    dropdown: 'select',
    color_picker: 'select',

    // Rich types
    timeline: 'timeline',
    doc: 'doc',
    file: 'file',
    link: 'url',
    email: 'email',
    phone: 'phone',
    checkbox: 'checkbox',

    // Relation types
    board_relation: 'relation',
    mirror: 'mirror',
    subtasks: 'subtasks',

    // Misc
    country: 'text',
    location: 'text',
    rating: 'number',
    auto_number: 'number',
    formula: 'text',
    tags: 'tags',
    week: 'date',
    hour: 'text',
    world_clock: 'text',
    dependency: 'relation',
};

/**
 * Special column name patterns for semantic field mapping
 */
const SPECIAL_COLUMN_PATTERNS: Array<{
    pattern: RegExp;
    specialMapping: ColumnMapping['specialMapping'];
}> = [
        { pattern: /^(owner|pm|manager|assigned|assignee)/i, specialMapping: 'owner' },
        { pattern: /^(due|deadline|target\s*date)/i, specialMapping: 'dueDate' },
        { pattern: /^(status|state|progress)/i, specialMapping: 'status' },
        { pattern: /^(title|name|item)/i, specialMapping: 'title' },
        { pattern: /^(desc|notes|details|description)/i, specialMapping: 'description' },
    ];

// ============================================================================
// INTERPRETER FUNCTIONS
// ============================================================================

/**
 * Generate a unique temporary ID for an import item
 */
function generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Infer entity type from Monday node type
 */
function inferEntityType(nodeType: MondayDataNode['type']): ImportPlanItem['entityType'] {
    switch (nodeType) {
        case 'board':
            return 'project';
        case 'group':
            return 'stage';
        case 'item':
            return 'task';
        case 'subitem':
            return 'subtask';
        default:
            return 'record';
    }
}

/**
 * Auto-generate column mapping from Monday column
 */
function autoMapColumn(column: MondayColumnValue): ColumnMapping {
    const renderHint = MONDAY_TYPE_TO_RENDER_HINT[column.type] ?? 'text';

    // Check for special column patterns
    for (const { pattern, specialMapping } of SPECIAL_COLUMN_PATTERNS) {
        if (pattern.test(column.title)) {
            return {
                fieldName: column.title,
                fieldType: 'string',
                renderHint,
                specialMapping,
            };
        }
    }

    return {
        fieldName: column.title,
        fieldType: renderHint === 'number' ? 'number' : 'string',
        renderHint,
    };
}

/**
 * Convert a Monday column value to a field recording
 */
function columnToFieldRecording(
    column: MondayColumnValue,
    mapping: ColumnMapping
): FieldRecording {
    return {
        fieldId: mapping.fieldId,
        fieldName: mapping.fieldName || column.title,
        value: column.text ?? column.value,
        renderHint: mapping.renderHint,
    };
}

/**
 * Interpret a Monday board and generate import plan items.
 */
export async function interpretMondayBoard(
    nodes: MondayDataNode[],
    options: { projectId?: string } = {}
): Promise<ImportPlanItem[]> {
    // Get learnings for this project
    const learnings = await getLearningsFor({
        sourceType: 'monday',
        projectId: options.projectId,
    });

    // Get existing definitions for potential matching
    const _definitions = await listDefinitions();

    // First pass: Generate items and track node ID -> tempId mapping
    const nodeIdToTempId = new Map<string, string>();
    const items: ImportPlanItem[] = [];

    for (const node of nodes) {
        // Generate auto-mappings for all columns
        const autoMappings = node.columnValues.map((cv) => ({
            columnName: cv.title,
            columnType: cv.type,
            mapping: autoMapColumn(cv),
        }));

        // Apply learned overrides
        const finalMappings = applyLearnings(autoMappings, learnings);

        // Create field recordings
        const fieldRecordings = node.columnValues.map((cv, index) => {
            const mapping = finalMappings[index]?.mapping ?? autoMapColumn(cv);
            return columnToFieldRecording(cv, mapping);
        });

        const tempId = generateTempId();
        nodeIdToTempId.set(node.id, tempId);

        items.push({
            tempId,
            title: node.name,
            entityType: inferEntityType(node.type),
            fieldRecordings,
            metadata: {
                monday: {
                    id: node.id,
                    type: node.type,
                    groupId: node.metadata.groupId,
                    groupTitle: node.metadata.groupTitle,
                    parentItemId: node.metadata.parentItemId,
                },
            },
        });
    }

    // Second pass: Resolve parent references for subitems
    for (const item of items) {
        const parentItemId = (item.metadata as { monday?: { parentItemId?: string } })?.monday?.parentItemId;
        if (parentItemId && nodeIdToTempId.has(parentItemId)) {
            item.parentTempId = nodeIdToTempId.get(parentItemId);
        }
    }

    return items;
}

/**
 * Interpret a single Monday node with specific mappings.
 */
export function interpretMondayNode(
    node: MondayDataNode,
    columnMappings?: Map<string, ColumnMapping>
): ImportPlanItem {
    const fieldRecordings = node.columnValues.map((cv) => {
        const mapping = columnMappings?.get(cv.id) ?? autoMapColumn(cv);
        return columnToFieldRecording(cv, mapping);
    });

    return {
        tempId: generateTempId(),
        title: node.name,
        entityType: inferEntityType(node.type),
        fieldRecordings,
        metadata: {
            monday: {
                id: node.id,
                type: node.type,
                groupId: node.metadata.groupId,
                groupTitle: node.metadata.groupTitle,
            },
        },
    };
}

export default {
    interpretMondayBoard,
    interpretMondayNode,
};
