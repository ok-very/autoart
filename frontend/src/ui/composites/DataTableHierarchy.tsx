/**
 * DataTableHierarchy - Reusable table composite for HierarchyNode data
 *
 * This is a REUSABLE COMPOSITE for HierarchyNode[] (tasks, subprocesses, etc.)
 * It does NOT fetch data - data is passed in as props.
 * ProjectWorkflowView uses this for task tables.
 *
 * For flat DataRecord data, use DataTableFlat instead.
 *
 * Features:
 * - Schema-driven columns from field definitions
 * - Inline editing via EditableCell
 * - Metadata parsing and value derivation
 * - Fallback values from parent (e.g., owner/dueDate from subprocess)
 * - Status derivation from metadata
 * - Expandable rows for subtasks (nesting)
 * - Sorting (delegated to UniversalTableCore)
 * - Row selection
 * - Builds FieldViewModels for cells
 *
 * Architecture:
 * - Uses UniversalTableCore for rendering
 * - Uses HierarchyRowModelAdapter for flattening nested nodes
 * - Wrapper handles status special handling, nesting expansion
 */

import { clsx } from 'clsx';
import { ChevronRight, Plus } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import type { FieldViewModel } from '@autoart/shared/domain';

import type { HierarchyNode, FieldDef } from '../../types';
import { type DataFieldKind } from '../molecules/DataFieldWidget';
import { EditableCell } from '../molecules/EditableCell';
import { StatusColumnSummary } from '../molecules/StatusColumnSummary';
import { StatusFieldEditor } from '../semantic/StatusFieldEditor';
import { UniversalTableCore, makeHierarchyRowModel, type TableColumn as CoreTableColumn, type TableRow } from '../table-core';

// ==================== TYPES ====================

export interface HierarchyFieldDef extends FieldDef {
    /** Field rendering hint */
    renderAs?: DataFieldKind;
    /** Show in collapsed (column) view */
    showInCollapsed?: boolean;
    /** Show in expanded row view */
    showInExpanded?: boolean;
    /** Column width */
    width?: number | 'flex';
}

export interface DataTableHierarchyProps {
    /** Hierarchy nodes to display */
    nodes: HierarchyNode[];
    /** Field definitions for columns */
    fields: HierarchyFieldDef[];
    /** Fallback values inherited from parent (e.g., subprocess owner) */
    fallbacks?: Record<string, unknown>;
    /** Currently selected node ID */
    selectedNodeId?: string | null;
    /** Callback when a node row is clicked */
    onRowSelect?: (nodeId: string) => void;
    /** Callback when a cell value changes */
    onCellChange?: (nodeId: string, fieldKey: string, value: unknown) => void;
    /** Callback to add a new node */
    onAddNode?: () => void;
    /** Custom value getter for a field (overrides default metadata lookup) */
    getFieldValue?: (node: HierarchyNode, fieldKey: string, fallbacks: Record<string, unknown>) => unknown;
    /** Custom status derivation function */
    deriveStatus?: (node: HierarchyNode) => string;
    /** Show status summary in footer */
    showStatusSummary?: boolean;
    /** Status configuration for summary */
    statusConfig?: Record<string, { label: string; colorClass: string }>;
    /** Empty state message */
    emptyMessage?: string;
    /** Additional className */
    className?: string;

    // ---- Subtask nesting support ----
    /** Enable subtask nesting (shows expand chevron for parent nodes) */
    enableNesting?: boolean;
    /** Get children of a node (for subtask nesting) */
    getChildren?: (nodeId: string) => HierarchyNode[];
    /** Field definitions for subtasks (defaults to same as fields) */
    subtaskFields?: HierarchyFieldDef[];
    /** Callback to add a subtask under a parent node */
    onAddSubtask?: (parentId: string) => void;
}

// ==================== HELPERS ====================

/**
 * Extract metadata from a node, parsing JSON string if needed
 */
function parseNodeMetadata(node: HierarchyNode): Record<string, unknown> {
    if (typeof node.metadata === 'string') {
        try {
            const parsed = JSON.parse(node.metadata);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    }
    return (node.metadata as Record<string, unknown>) || {};
}

/**
 * Check if a value looks like a valid date string (YYYY-MM-DD format)
 */
function isValidDateString(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}/.test(value);
}

/**
 * Default value getter for hierarchy nodes
 */
function defaultGetFieldValue(
    node: HierarchyNode,
    fieldKey: string,
    fallbacks: Record<string, unknown>
): unknown {
    // Special top-level node fields
    if (fieldKey === 'title') return node.title;
    if (fieldKey === 'description') return node.description;
    if (fieldKey === 'type') return node.type;

    // Metadata fields with fallback support
    const meta = parseNodeMetadata(node);
    const value = meta[fieldKey];

    // Special handling for date fields - validate format
    if (fieldKey === 'dueDate' || fieldKey.toLowerCase().includes('date')) {
        if (isValidDateString(value)) {
            return value;
        }
        // Try fallback if value is invalid
        if (isValidDateString(fallbacks[fieldKey])) {
            return fallbacks[fieldKey];
        }
        return null;
    }

    // Return fallback if value is null/undefined
    if (value == null && fallbacks[fieldKey] != null) {
        return fallbacks[fieldKey];
    }

    return value ?? null;
}

// ==================== DATA TABLE HIERARCHY ====================

export function DataTableHierarchy({
    nodes,
    fields,
    fallbacks = {},
    selectedNodeId,
    onRowSelect,
    onCellChange,
    onAddNode,
    getFieldValue = defaultGetFieldValue,
    deriveStatus,
    showStatusSummary = false,
    statusConfig = {},
    emptyMessage = 'No items found',
    className,
    // Subtask nesting props
    enableNesting = false,
    getChildren,
    subtaskFields: _subtaskFields,
    onAddSubtask: _onAddSubtask, // TODO: Implement add subtask button in expanded section
}: DataTableHierarchyProps) {
    // Track which parent nodes have their children (subtasks) visible
    const [expandedChildrenIds, setExpandedChildrenIds] = useState<Set<string>>(new Set());

    // Filter fields for collapsed view (shown as columns)
    const collapsedFields = useMemo(
        () => fields.filter((f) => f.showInCollapsed !== false && f.key !== 'title'),
        [fields]
    );

    // Build FieldViewModel for a cell (simplified for hierarchy nodes)
    const buildCellViewModel = useCallback((field: HierarchyFieldDef, node: HierarchyNode): FieldViewModel => {
        const value = getFieldValue(node, field.key, fallbacks);

        const viewModel: FieldViewModel = {
            fieldId: field.key,
            label: field.label,
            type: field.type,
            value,
            editable: true,
            visible: true,
            required: field.required ?? false,
            options: field.options,
            placeholder: `Enter ${field.label.toLowerCase()}...`,
        };

        return viewModel;
    }, [getFieldValue, fallbacks]);

    // Handle children (subtask) visibility toggle
    const handleToggleChildren = useCallback((nodeId: string) => {
        setExpandedChildrenIds((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, []);

    // Default status derivation from node metadata
    const defaultDeriveStatus = useCallback((node: HierarchyNode): string => {
        const meta = parseNodeMetadata(node);
        return String(meta.status || 'not-started');
    }, []);

    // Use provided deriveStatus or default
    const getStatus = deriveStatus || defaultDeriveStatus;

    // Row model using HierarchyRowModelAdapter with flattening
    const rowModel = useMemo(() => {
        return makeHierarchyRowModel({
            nodes,
            getChildren: enableNesting ? getChildren : undefined,
            expandedIds: expandedChildrenIds,
            onToggleExpanded: handleToggleChildren,
        });
    }, [nodes, enableNesting, getChildren, expandedChildrenIds, handleToggleChildren]);

    // Convert fields to core columns with cell() functions
    const coreColumns = useMemo<CoreTableColumn[]>(() => {
        const cols: CoreTableColumn[] = [];

        // Title column with indent and chevron
        cols.push({
            id: 'title',
            header: 'Title',
            width: 280,
            minWidth: 150,
            resizable: true,
            sortKey: (row: TableRow) => {
                const node = row.data as HierarchyNode;
                return node.title || '';
            },
            cell: (row: TableRow) => {
                const node = row.data as HierarchyNode;
                const depth = (row.meta?.depth as number) || 0;
                const hasChildren = (row.meta?.hasChildren as boolean) || false;
                const isExpanded = (row.meta?.isExpanded as boolean) || false;
                const indentPx = depth * 24;

                return (
                    <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${indentPx}px` }}
                    >
                        {/* Nesting toggle chevron */}
                        {enableNesting && hasChildren && (
                            <button
                                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 shrink-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleChildren(node.id);
                                }}
                            >
                                <ChevronRight
                                    size={14}
                                    className={clsx('transition-transform', isExpanded && 'rotate-90')}
                                />
                            </button>
                        )}
                        {/* Spacer when no children */}
                        {enableNesting && !hasChildren && depth === 0 && (
                            <div className="w-5 shrink-0" />
                        )}
                        {/* Subtask indicator dot */}
                        {depth > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                        )}
                        {/* Title editor */}
                        <div className="flex-1 min-w-0">
                            <EditableCell
                                viewModel={buildCellViewModel({ key: 'title', label: 'Title', type: 'text' }, node)}
                                onSave={(_fieldId, value) => onCellChange?.(node.id, 'title', value)}
                            />
                        </div>
                    </div>
                );
            },
        });

        // Dynamic columns from fields
        for (const field of collapsedFields) {
            const width = typeof field.width === 'number' ? field.width : 130;

            cols.push({
                id: field.key,
                header: field.label,
                width,
                minWidth: 80,
                resizable: true,
                align: 'center',
                sortKey: (row: TableRow) => {
                    const node = row.data as HierarchyNode;
                    const val = getFieldValue(node, field.key, fallbacks);
                    return val == null ? null : String(val);
                },
                cell: (row: TableRow) => {
                    const node = row.data as HierarchyNode;
                    const viewModel = buildCellViewModel(field, node);

                    // Status field - use StatusFieldEditor for inline editing
                    if (field.key === 'status' || field.type === 'status') {
                        const status = getStatus(node);
                        return (
                            <div onClick={(e) => e.stopPropagation()}>
                                <StatusFieldEditor
                                    value={status}
                                    statusConfig={statusConfig}
                                    onChange={(val) => onCellChange?.(node.id, 'status', val)}
                                    compact
                                />
                            </div>
                        );
                    }

                    return (
                        <EditableCell
                            viewModel={viewModel}
                            onSave={(_fieldId, value) => onCellChange?.(node.id, field.key, value)}
                        />
                    );
                },
            });
        }

        return cols;
    }, [collapsedFields, enableNesting, buildCellViewModel, handleToggleChildren, onCellChange, getFieldValue, fallbacks, getStatus, statusConfig]);

    // Row className for selection
    const getRowClassName = useCallback((row: TableRow) => {
        const node = row.data as HierarchyNode;
        const depth = (row.meta?.depth as number) || 0;
        const isSelected = node.id === selectedNodeId;

        if (isSelected) return 'bg-blue-50';
        if (depth > 0) return 'bg-slate-50/50';
        return '';
    }, [selectedNodeId]);

    // Row click handler
    const handleRowClick = useCallback((rowId: string) => {
        onRowSelect?.(rowId);
    }, [onRowSelect]);

    // Footer with status summary
    const renderFooter = useCallback(() => {
        if (!showStatusSummary || nodes.length === 0) return null;

        // Compute status counts
        const statusCounts: Record<string, number> = {};
        for (const node of nodes) {
            const status = getStatus(node);
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        }

        const statusCountsArray = Object.entries(statusCounts).map(([status, count]) => ({
            status,
            count,
        }));

        const colorConfig = Object.keys(statusConfig).length > 0
            ? Object.fromEntries(
                Object.entries(statusConfig).map(([status, config]) => [
                    status,
                    {
                        bgClass: config.colorClass || 'bg-slate-400',
                        textClass: 'text-slate-600',
                    },
                ])
            )
            : undefined;

        return (
            <div className="flex h-10 items-center">
                {/* Title column - show total count */}
                <div className="px-3" style={{ width: 280, minWidth: 150 }}>
                    <span className="text-xs font-semibold text-slate-600">
                        {nodes.length} item{nodes.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Dynamic columns - show status summary in status column */}
                {collapsedFields.map((field) => {
                    const width = typeof field.width === 'number' ? field.width : 130;

                    if (field.key === 'status' || field.type === 'status') {
                        return (
                            <div key={field.key} className="px-2" style={{ width }}>
                                <StatusColumnSummary
                                    counts={statusCountsArray}
                                    colorConfig={colorConfig}
                                />
                            </div>
                        );
                    }

                    return <div key={field.key} className="px-2" style={{ width }} />;
                })}

                <div className="flex-1" />
            </div>
        );
    }, [showStatusSummary, nodes, collapsedFields, getStatus, statusConfig]);

    return (
        <div className={clsx('flex flex-col border border-slate-200 rounded-lg overflow-hidden', className)}>
            {/* Core table */}
            <UniversalTableCore
                rowModel={rowModel}
                columns={coreColumns}
                onRowClick={handleRowClick}
                getRowClassName={getRowClassName}
                stickyHeader
                stickyFooter={showStatusSummary}
                emptyState={<span className="text-sm">{emptyMessage}</span>}
                renderFooter={showStatusSummary ? renderFooter : undefined}
            />

            {/* Add button */}
            {onAddNode && (
                <div className="border-t border-slate-200">
                    <button
                        onClick={onAddNode}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                        <Plus size={14} />
                        Add Item
                    </button>
                </div>
            )}
        </div>
    );
}
