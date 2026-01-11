/**
 * Hierarchy Row Model Adapter
 *
 * Adapts HierarchyNode[] to RowModel for use with UniversalTableCore.
 * Handles flattening of tree structure with depth tracking.
 *
 * Used by DataTableHierarchy for one-level nesting (parent + children).
 */

import type { RowModel, TableRow, RowId } from '../types';

/**
 * Minimal HierarchyNode type - keep adapter loosely coupled
 */
export interface HierarchyNodeLike {
    id: string;
    title?: string;
    type?: string;
    metadata?: unknown;
    [key: string]: unknown;
}

export interface HierarchyRowModelOptions<T extends HierarchyNodeLike> {
    /** The root-level nodes */
    nodes: T[];
    /** Get children of a node (for one-level nesting) */
    getChildren?: (nodeId: string) => T[];
    /** Set of expanded node IDs */
    expandedIds?: Set<string>;
    /** Callback when expansion state changes */
    onToggleExpanded?: (nodeId: string) => void;
}

/**
 * Create a RowModel from hierarchy nodes with optional nesting.
 *
 * Flattens the tree structure so core renders a flat list,
 * while preserving depth information in row.meta for indent rendering.
 */
export function makeHierarchyRowModel<T extends HierarchyNodeLike>(
    options: HierarchyRowModelOptions<T>
): RowModel {
    const { nodes, getChildren, expandedIds = new Set(), onToggleExpanded } = options;

    // Flatten nodes with depth tracking
    const flattenNodes = (): TableRow[] => {
        const result: TableRow[] = [];

        const addNode = (node: T, depth: number, parentId?: string) => {
            const nodeChildren = getChildren?.(node.id) ?? [];
            const hasChildren = nodeChildren.length > 0;
            const isExpanded = expandedIds.has(node.id);

            result.push({
                id: node.id,
                data: node,
                meta: {
                    depth,
                    parentId,
                    hasChildren,
                    isExpanded,
                },
            });

            // Add children if expanded
            if (hasChildren && isExpanded) {
                for (const child of nodeChildren) {
                    addNode(child, depth + 1, node.id);
                }
            }
        };

        for (const node of nodes) {
            addNode(node, 0);
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
            expandable: !!getChildren,
        },
        isExpanded: (id: RowId) => expandedIds.has(id),
        toggleExpanded: onToggleExpanded,
    };
}

/**
 * Helper to get hierarchy-specific metadata from a TableRow.
 */
export function getHierarchyMeta(row: TableRow) {
    return {
        depth: (row.meta?.depth as number) ?? 0,
        parentId: row.meta?.parentId as string | undefined,
        hasChildren: (row.meta?.hasChildren as boolean) ?? false,
        isExpanded: (row.meta?.isExpanded as boolean) ?? false,
    };
}
