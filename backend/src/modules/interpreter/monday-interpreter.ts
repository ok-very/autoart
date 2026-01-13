/**
 * Monday.com Interpreter
 *
 * Translates Monday.com data nodes into ImportPlanItems.
 * Maps Monday columns to AutoArt fields using:
 * 1. Existing definition matches
 * 2. Learned user preferences
 * 3. Auto-inference from column types/names
 */

import {
    getLearningsFor,
    applyLearnings,
    type ColumnMapping,
} from './inference-learner.js';
import type { MondayDataNode, MondayColumnValue } from '../imports/connectors/monday-connector.js';
import type { ImportPlanItem } from '../imports/types.js';
import { listDefinitions } from '../records/records.service.js';

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
        { pattern: /^(owner|pm|manager|assigned|assignee)/i, specialMapping: 'assignee' },
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

// ============================================================================
// ENTITY TYPE INFERENCE
// ============================================================================

/**
 * Group name patterns that indicate items within should be PROCESS entityType
 * These are reusable workflow templates or project definitions
 */
const PROCESS_GROUP_PATTERNS = [
    /^templates?$/i,
    /^process(es)?$/i,
    /^workflows?$/i,
    /^projects?$/i,
    /^initiatives?$/i,
];

/**
 * Template item patterns - items matching these are SINGLETON template records
 * They float outside hierarchy (no parentTempId) and deduplicate by external_id.
 */
const TEMPLATE_ITEM_PATTERNS = [
    /\btemplate$/i,              // Ends with "Template" (e.g., "Vancouver Template")
    /^template\s*[-:]/i,         // Starts with "Template -" or "Template:"
];

/**
 * Check if an item name matches template patterns.
 * Templates are singleton records that float outside stage projections.
 */
function isTemplateItem(name: string): boolean {
    return TEMPLATE_ITEM_PATTERNS.some(p => p.test(name));
}

/**
 * Infer entity type from Monday node using context-aware rules.
 * 
 * Mapping logic:
 * - Template items (matching patterns) → template (singleton records, hierarchy-agnostic)
 * - board → project (always)
 * - group → subprocess (container for items within)
 * - item in Templates/Processes group → process (even without subitems)
 * - item WITH subitems → process (container for children)
 * - item WITHOUT subitems → task
 * - subitem → task (leaf work item)
 * 
 * NOTE: Entity type inference is separate from hierarchy structure.
 * Items still nest under their group containers regardless of entityType.
 */
function inferEntityType(
    nodeType: MondayDataNode['type'],
    context?: { groupTitle?: string; hasSubitems?: boolean; itemName?: string }
): ImportPlanItem['entityType'] {
    // Template detection - takes priority over other classifications
    // Templates are singleton records that float outside hierarchy
    if (context?.itemName && isTemplateItem(context.itemName)) {
        return 'template';
    }

    switch (nodeType) {
        case 'board':
            return 'project';

        case 'group':
            // Groups become subprocess containers
            return 'subprocess' as ImportPlanItem['entityType'];

        case 'item': {
            // Items WITH subitems are always containers (process)
            if (context?.hasSubitems) {
                return 'process' as ImportPlanItem['entityType'];
            }

            // Items in Templates/Processes/Projects groups → PROCESS
            // These define reusable workflows, not actionable tasks
            const groupTitle = context?.groupTitle;
            if (groupTitle && PROCESS_GROUP_PATTERNS.some(p => p.test(groupTitle.trim()))) {
                return 'process' as ImportPlanItem['entityType'];
            }

            // All other items are tasks
            return 'task';
        }

        case 'subitem':
            // Subitems are always tasks (the actual work)
            return 'task';

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

        // Check if this item has subitems (look ahead in nodes list)
        const hasSubitems = node.type === 'item' && nodes.some(
            n => n.type === 'subitem' && n.metadata.parentItemId === node.id
        );

        // Infer entity type with context (including item name for template detection)
        const entityType = inferEntityType(node.type, {
            groupTitle: node.metadata.groupTitle,
            hasSubitems,
            itemName: node.name, // Pass name for template pattern matching
        });

        // Templates are hierarchy-agnostic singletons - they float outside stage projections
        const isTemplate = entityType === 'template';

        items.push({
            tempId,
            title: node.name,
            entityType,
            // Templates get NO parentTempId - they float outside hierarchy
            parentTempId: isTemplate ? undefined : undefined, // Will be resolved in second pass
            fieldRecordings,
            metadata: {
                monday: {
                    id: node.id,
                    type: node.type,
                    groupId: node.metadata.groupId,
                    groupTitle: node.metadata.groupTitle,
                    parentItemId: node.metadata.parentItemId,
                    hasSubitems, // Preserve for downstream use
                },
                // Template singleton flag for deduplication and UI filtering
                ...(isTemplate && { isTemplateSingleton: true }),
            },
        });
    }

    // Second pass: Resolve parent references for subitems
    // If parent can't be resolved, flag metadata for classification review
    // Templates are SKIPPED - they remain hierarchy-agnostic
    for (const item of items) {
        // Templates don't get parent assignment - they float outside hierarchy
        if (item.entityType === 'template') {
            continue;
        }

        const mondayMeta = item.metadata?.monday as { parentItemId?: string; type?: string } | undefined;
        const parentItemId = mondayMeta?.parentItemId;

        if (parentItemId) {
            if (nodeIdToTempId.has(parentItemId)) {
                // Explicit parent resolution - subitem → parent item
                item.parentTempId = nodeIdToTempId.get(parentItemId);
            } else {
                // Parent not in batch - flag for classification review
                // This makes the implicit relationship explicit via metadata
                item.metadata = {
                    ...item.metadata,
                    _parentResolutionFailed: true,
                    _orphanedParentId: parentItemId,
                };
                console.warn(
                    `[monday-interpreter] Subitem "${item.title}" flagged for review: parent ${parentItemId} not in import batch`
                );
            }
        }

        // Also flag items without any parent if they're subitems (should never happen but be defensive)
        if (mondayMeta?.type === 'subitem' && !item.parentTempId && !parentItemId) {
            item.metadata = {
                ...item.metadata,
                _parentResolutionFailed: true,
                _reason: 'subitem_without_parent_reference',
            };
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
