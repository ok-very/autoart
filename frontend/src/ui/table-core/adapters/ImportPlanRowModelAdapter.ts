/**
 * Import Plan Row Model Adapter
 *
 * Converts ImportPlan (containers + items) to RowModel for UniversalTableCore.
 * Builds tree structure with depth tracking for hierarchical display.
 */

import { resolveEntityKind, type EntityKind } from '@autoart/shared';

import type { RowModel, TableRow, RowId } from '../types';
import type { ImportPlan, ImportPlanContainer, ImportPlanItem, ItemClassification } from '../../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportPlanNode {
    id: string;
    title: string;
    nodeType: 'container' | 'item';
    entityKind: EntityKind;
    parentId: string | null;
    data: ImportPlanContainer | ImportPlanItem;
    classification?: ItemClassification;
    children: ImportPlanNode[];
}

export interface ImportPlanRowMeta {
    depth: number;
    parentId: string | null;
    hasChildren: boolean;
    isExpanded: boolean;
    nodeType: 'container' | 'item';
    entityKind: EntityKind;
    classification?: ItemClassification;
}

export interface ImportPlanAdapterOptions {
    plan: ImportPlan;
    expandedIds: Set<string>;
    onToggleExpanded: (id: string) => void;
}

// ============================================================================
// TREE BUILDER
// ============================================================================

function buildImportTree(plan: ImportPlan): ImportPlanNode[] {
    const nodeMap = new Map<string, ImportPlanNode>();

    // Build classification lookup
    const classificationMap = new Map<string, ItemClassification>();
    if (plan.classifications) {
        for (const c of plan.classifications) {
            classificationMap.set(c.itemTempId, c);
        }
    }

    // Add containers
    for (const container of plan.containers) {
        nodeMap.set(container.tempId, {
            id: container.tempId,
            title: container.title,
            nodeType: 'container',
            entityKind: resolveEntityKind({ type: container.type }),
            parentId: container.parentTempId,
            data: container,
            children: [],
        });
    }

    // Add items with classifications
    for (const item of plan.items) {
        nodeMap.set(item.tempId, {
            id: item.tempId,
            title: item.title,
            nodeType: 'item',
            entityKind: resolveEntityKind(item),
            parentId: item.parentTempId ?? null,
            data: item,
            classification: classificationMap.get(item.tempId),
            children: [],
        });
    }

    // Build parent-child relationships
    const roots: ImportPlanNode[] = [];
    for (const node of nodeMap.values()) {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}

// ============================================================================
// ROW MODEL ADAPTER
// ============================================================================

/**
 * Create a RowModel from ImportPlan with hierarchical nesting.
 */
export function makeImportPlanRowModel(options: ImportPlanAdapterOptions): RowModel {
    const { plan, expandedIds, onToggleExpanded } = options;

    // Build tree structure
    const roots = buildImportTree(plan);

    // Flatten with depth tracking
    const flattenNodes = (): TableRow[] => {
        const result: TableRow[] = [];

        const addNode = (node: ImportPlanNode, depth: number) => {
            const hasChildren = node.children.length > 0;
            const isExpanded = expandedIds.has(node.id);

            result.push({
                id: node.id,
                data: node,
                meta: {
                    depth,
                    parentId: node.parentId,
                    hasChildren,
                    isExpanded,
                    nodeType: node.nodeType,
                    entityKind: node.entityKind,
                    classification: node.classification,
                } satisfies ImportPlanRowMeta,
            });

            // Add children if expanded
            if (hasChildren && isExpanded) {
                for (const child of node.children) {
                    addNode(child, depth + 1);
                }
            }
        };

        for (const root of roots) {
            addNode(root, 0);
        }

        return result;
    };

    const rows = flattenNodes();
    const rowMap = new Map(rows.map((r) => [r.id, r]));

    return {
        getRows: () => rows,
        getRowById: (id) => rowMap.get(id),
        capabilities: {
            selectable: true,
            expandable: true,
        },
        isExpanded: (id: RowId) => expandedIds.has(id),
        toggleExpanded: onToggleExpanded,
    };
}

/**
 * Helper to extract ImportPlanRowMeta from a TableRow.
 */
export function getImportPlanMeta(row: TableRow): ImportPlanRowMeta {
    const meta = row.meta ?? {};
    return {
        depth: (meta.depth as number) ?? 0,
        parentId: (meta.parentId as string | null) ?? null,
        hasChildren: (meta.hasChildren as boolean) ?? false,
        isExpanded: (meta.isExpanded as boolean) ?? false,
        nodeType: (meta.nodeType as 'container' | 'item') ?? 'item',
        entityKind: (meta.entityKind as EntityKind) ?? 'action',
        classification: meta.classification as ItemClassification | undefined,
    };
}

/**
 * Helper to extract ImportPlanNode from a TableRow.
 */
export function getImportPlanNode(row: TableRow): ImportPlanNode {
    return row.data as ImportPlanNode;
}

