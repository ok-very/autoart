/**
 * Monday.com Interpreter
 *
 * Translates Monday.com data nodes into ImportPlanItems.
 * Maps Monday columns to AutoArt fields using:
 * 1. Existing definition matches
 * 2. Learned user preferences
 * 3. Auto-inference from column types/names
 */

import { type RenderHint } from '@autoart/shared';

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
    /** Pending linked item IDs from board_relation/mirror columns for post-import resolution */
    _pendingLinks?: string[];
}

// ============================================================================
// COLUMN TYPE MAPPING
// ============================================================================

/**
 * Map Monday column types to canonical AutoArt RenderHints.
 *
 * Translation rules for Monday-specific types:
 * - timeline: Produces two date fields (start/end) - handled in extraction
 * - doc: Monday Docs → 'richtext' (rich text editor content)
 * - mirror: Derive from mirrored column's source type, default to 'text'
 * - subtasks: Structural relationship → 'relation'
 *
 * Source: Monday.com GraphQL API column type discovery.
 */
const MONDAY_TYPE_TO_RENDER_HINT: Record<string, RenderHint> = {
    // Core text types
    name: 'text',
    text: 'text',
    long_text: 'richtext',

    // Selection types
    status: 'status',
    dropdown: 'select',
    color_picker: 'select',
    checkbox: 'checkbox',
    tags: 'tags',

    // People
    people: 'person',

    // Dates
    date: 'date',
    week: 'date',

    // Numbers
    numbers: 'number',
    rating: 'number',
    auto_number: 'number',

    // Communication
    link: 'url',
    email: 'email',
    phone: 'phone',

    // Attachments
    file: 'file',

    // Relations (structural)
    board_relation: 'relation',
    dependency: 'relation',

    // Text fallbacks (misc Monday types)
    country: 'text',
    location: 'text',
    formula: 'text',
    hour: 'text',
    world_clock: 'text',
};

/**
 * Monday-specific column types that require special translation.
 * These don't map directly to a canonical RenderHint.
 */
const MONDAY_TRANSLATION_TYPES = {
    /** Timeline produces two date fields (start_date, end_date) */
    timeline: 'date',
    /** Doc is Monday's rich text document editor */
    doc: 'richtext',
    /** Mirror derives type from source column, defaults to text */
    mirror: 'text',
    /** Subtasks are child relationships */
    subtasks: 'relation',
} as const satisfies Record<string, RenderHint>;

/**
 * Get canonical RenderHint for a Monday column type.
 * Falls back to 'text' for unknown types.
 */
export function getMondayRenderHint(mondayType: string): RenderHint {
    if (mondayType in MONDAY_TYPE_TO_RENDER_HINT) {
        return MONDAY_TYPE_TO_RENDER_HINT[mondayType];
    }
    if (mondayType in MONDAY_TRANSLATION_TYPES) {
        return MONDAY_TRANSLATION_TYPES[mondayType as keyof typeof MONDAY_TRANSLATION_TYPES];
    }
    return 'text';
}

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
 * Generate a unique temporary ID for an import item.
 * Includes boardId prefix for multi-board imports to ensure consistent parent refs.
 */
function generateTempId(boardId?: string): string {
    const prefix = boardId ? `b${boardId}_` : '';
    return `temp_${prefix}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
 * Extract linked item IDs from board_relation or mirror column values.
 * Monday stores these as JSON with linkedPulseIds or linked_item_ids.
 */
function extractLinkedItemIds(column: MondayColumnValue): string[] {
    if (column.type !== 'board_relation' && column.type !== 'mirror') {
        return [];
    }

    const value = column.value;
    if (!value || typeof value !== 'object') {
        return [];
    }

    // board_relation format: { linkedPulseIds: [{ linkedPulseId: 123 }, ...] }
    // or: { linked_item_ids: [123, 456, ...] }
    const linkedPulseIds = (value as { linkedPulseIds?: Array<{ linkedPulseId: number }> }).linkedPulseIds;
    if (Array.isArray(linkedPulseIds)) {
        return linkedPulseIds.map(p => String(p.linkedPulseId));
    }

    const linkedItemIds = (value as { linked_item_ids?: number[] }).linked_item_ids;
    if (Array.isArray(linkedItemIds)) {
        return linkedItemIds.map(id => String(id));
    }

    return [];
}

/**
 * Convert a Monday column value to a field recording.
 * For relation/mirror columns, extracts linked item IDs for post-import resolution.
 */
function columnToFieldRecording(
    column: MondayColumnValue,
    mapping: ColumnMapping
): FieldRecording {
    // For relation/mirror columns, extract linked item IDs for resolution
    const linkedIds = (column.type === 'board_relation' || column.type === 'mirror')
        ? extractLinkedItemIds(column)
        : [];

    return {
        fieldId: mapping.fieldId,
        fieldName: mapping.fieldName || column.title,
        value: column.text ?? column.value,
        renderHint: mapping.renderHint,
        ...(linkedIds.length > 0 && { _pendingLinks: linkedIds }),
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

        const boardId = node.metadata.boardId;
        const tempId = generateTempId(boardId);
        // Use compound key for multi-board disambiguation
        const nodeKey = boardId ? `${boardId}:${node.id}` : node.id;
        nodeIdToTempId.set(nodeKey, tempId);

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

        const isTemplate = entityType === 'template';

        items.push({
            tempId,
            title: node.name,
            entityType,
            // parentTempId will be resolved in second pass for all items
            // Templates stay nested in their group within the same import
            parentTempId: undefined,
            fieldRecordings,
            metadata: {
                monday: {
                    id: node.id,
                    type: node.type,
                    boardId: node.metadata.boardId,
                    boardName: node.metadata.boardName,
                    groupId: node.metadata.groupId,
                    groupTitle: node.metadata.groupTitle,
                    parentItemId: node.metadata.parentItemId,
                    hasSubitems,
                },
                // Template flag for UI filtering (deduplication happens in imports.service cross-import)
                ...(isTemplate && { isTemplateSingleton: true }),
            },
        });
    }

    // Second pass: Resolve parent references for subitems
    // If parent can't be resolved, flag metadata for classification review
    // ALL items (including templates) get parent assignment - they stay nested in their group
    for (const item of items) {
        const mondayMeta = item.metadata?.monday as { 
            parentItemId?: string; 
            type?: string;
            boardId?: string;
        } | undefined;
        const parentItemId = mondayMeta?.parentItemId;
        const boardId = mondayMeta?.boardId;

        if (parentItemId) {
            // Use compound key for multi-board disambiguation
            const parentKey = boardId ? `${boardId}:${parentItemId}` : parentItemId;
            if (nodeIdToTempId.has(parentKey)) {
                // Explicit parent resolution - subitem → parent item
                item.parentTempId = nodeIdToTempId.get(parentKey);
            } else {
                // Parent not in batch - flag for classification review
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
