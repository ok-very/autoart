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
 * - Expandable rows for additional fields
 * - Sorting (internal state)
 * - Row selection
 * - Builds FieldViewModels for cells
 */

import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { EditableCell } from '../molecules/EditableCell';
import { DataFieldWidget, type DataFieldKind } from '../molecules/DataFieldWidget';
import { StatusColumnSummary } from '../molecules/StatusColumnSummary';
import type { FieldViewModel } from '@autoart/shared/domain';
import type { HierarchyNode, FieldDef } from '../../types';

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
    subtaskFields,
    onAddSubtask,
}: DataTableHierarchyProps) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    // Track which parent nodes have their children (subtasks) visible
    const [expandedChildrenIds, setExpandedChildrenIds] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Fields for subtasks (default to same as parent fields)
    const effectiveSubtaskFields = subtaskFields || fields;

    // Filter fields for collapsed view (shown as columns)
    const collapsedFields = useMemo(
        () => fields.filter((f) => f.showInCollapsed !== false && f.key !== 'title'),
        [fields]
    );

    // Filter fields for expanded view
    const expandedFields = useMemo(
        () => fields.filter((f) => f.showInExpanded && !f.showInCollapsed),
        [fields]
    );

    // Build FieldViewModel for a cell (simplified for hierarchy nodes)
    const buildCellViewModel = useCallback((field: HierarchyFieldDef, node: HierarchyNode): FieldViewModel => {
        const value = getFieldValue(node, field.key, fallbacks);

        // Build a simple FieldViewModel for hierarchy nodes
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

    // Sorted nodes
    const sortedNodes = useMemo(() => {
        if (!sortConfig) return nodes;

        return [...nodes].sort((a, b) => {
            const aVal = getFieldValue(a, sortConfig.key, fallbacks);
            const bVal = getFieldValue(b, sortConfig.key, fallbacks);

            // Handle nulls
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // String comparison
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const cmp = aVal.localeCompare(bVal);
                return sortConfig.direction === 'asc' ? cmp : -cmp;
            }

            // Number comparison
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            return 0;
        });
    }, [nodes, sortConfig, getFieldValue, fallbacks]);

    // Handle sort toggle
    const handleSort = useCallback((key: string) => {
        setSortConfig((prev) => {
            if (prev?.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                return null; // Clear sort
            }
            return { key, direction: 'asc' };
        });
    }, []);

    // Handle row expansion toggle
    const handleToggleExpand = useCallback((nodeId: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, []);

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

    // Check if a node has children (subtasks)
    const hasChildren = useCallback((nodeId: string): boolean => {
        if (!enableNesting || !getChildren) return false;
        const children = getChildren(nodeId);
        return children.length > 0;
    }, [enableNesting, getChildren]);

    // Default status derivation from node metadata
    const defaultDeriveStatus = useCallback((node: HierarchyNode): string => {
        const meta = parseNodeMetadata(node);
        return String(meta.status || 'not-started');
    }, []);

    // Use provided deriveStatus or default
    const getStatus = deriveStatus || defaultDeriveStatus;

    // Compute status counts for footer
    const statusCounts = useMemo(() => {
        if (!showStatusSummary) return {};

        const counts: Record<string, number> = {};
        for (const node of nodes) {
            const status = getStatus(node);
            counts[status] = (counts[status] || 0) + 1;
        }
        return counts;
    }, [nodes, getStatus, showStatusSummary]);

    // Render header row
    const renderHeader = () => (
        <div className="flex h-8 items-center border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
            {/* Expand toggle column */}
            {expandedFields.length > 0 && <div className="w-8 shrink-0" />}

            {/* Title column */}
            <div
                className="w-[280px] min-w-[150px] shrink-0 px-3 cursor-pointer hover:bg-slate-100 flex items-center gap-1"
                onClick={() => handleSort('title')}
            >
                <span>Title</span>
                {sortConfig?.key === 'title' && (
                    <span className="text-blue-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
            </div>

            {/* Dynamic columns */}
            {collapsedFields.map((field) => {
                const width = typeof field.width === 'number' ? field.width : 130;
                return (
                    <div
                        key={field.key}
                        className="px-2 cursor-pointer hover:bg-slate-100 flex items-center gap-1 justify-center"
                        style={{ width }}
                        onClick={() => handleSort(field.key)}
                    >
                        <span>{field.label}</span>
                        {sortConfig?.key === field.key && (
                            <span className="text-blue-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                    </div>
                );
            })}

            <div className="flex-1" />
        </div>
    );

    // Render a single row (can be recursively called for subtasks)
    const renderRow = (node: HierarchyNode, depth: number = 0, parentFields?: HierarchyFieldDef[]) => {
        const isSelected = node.id === selectedNodeId;
        const isExpanded = expandedIds.has(node.id);
        const isChildrenExpanded = expandedChildrenIds.has(node.id);
        const status = getStatus(node);
        const nodeHasChildren = hasChildren(node.id);
        const nodeChildren = enableNesting && getChildren ? getChildren(node.id) : [];
        const fieldsToUse = parentFields || collapsedFields;
        const isSubtask = depth > 0;
        const indentPx = depth * 24;

        return (
            <div key={node.id}>
                {/* Main row */}
                <div
                    className={clsx(
                        'flex items-center border-b border-slate-100 cursor-pointer transition-colors',
                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50',
                        isSubtask && 'bg-slate-50/50'
                    )}
                    onClick={() => onRowSelect?.(node.id)}
                >
                    {/* Expand toggle for field details */}
                    {expandedFields.length > 0 && (
                        <button
                            className="w-8 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpand(node.id);
                            }}
                        >
                            <span className={clsx('transition-transform', isExpanded && 'rotate-90')}>
                                ▶
                            </span>
                        </button>
                    )}

                    {/* Title cell with nesting chevron and indentation */}
                    <div
                        className="w-[280px] min-w-[150px] shrink-0 px-3 py-2 flex items-center gap-1"
                        style={{ paddingLeft: `${12 + indentPx}px` }}
                    >
                        {/* Nesting toggle chevron (for parent nodes with children) */}
                        {enableNesting && nodeHasChildren && (
                            <button
                                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 shrink-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleChildren(node.id);
                                }}
                            >
                                <span className={clsx('text-xs transition-transform', isChildrenExpanded && 'rotate-90')}>
                                    ▶
                                </span>
                            </button>
                        )}
                        {/* Spacer when nesting is enabled but node has no children */}
                        {enableNesting && !nodeHasChildren && depth === 0 && (
                            <div className="w-5 shrink-0" />
                        )}
                        {/* Subtask indicator dot */}
                        {isSubtask && (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            <EditableCell
                                viewModel={buildCellViewModel({ key: 'title', label: 'Title', type: 'text' }, node)}
                                onSave={(value) => onCellChange?.(node.id, 'title', value)}
                            />
                        </div>
                    </div>

                    {/* Dynamic cells */}
                    {fieldsToUse.map((field) => {
                        const width = typeof field.width === 'number' ? field.width : 130;
                        const viewModel = buildCellViewModel(field, node);

                        // Special rendering for status with percent
                        if (field.key === 'status' && status) {
                            const percentValue = getFieldValue(node, 'percentComplete', fallbacks);
                            return (
                                <div key={field.key} className="px-2 py-2 flex flex-col items-center gap-1" style={{ width }}>
                                    <DataFieldWidget kind="status" value={status} />
                                    {percentValue != null && (
                                        <DataFieldWidget kind="percent" value={percentValue} />
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div key={field.key} className="px-2 py-2" style={{ width }}>
                                <EditableCell
                                    viewModel={viewModel}
                                    onSave={(value) => onCellChange?.(node.id, field.key, value)}
                                />
                            </div>
                        );
                    })}

                    <div className="flex-1" />
                </div>

                {/* Expanded content (field details) */}
                {isExpanded && expandedFields.length > 0 && (
                    <div className="px-12 py-3 bg-slate-50 border-b border-slate-200" style={{ marginLeft: `${indentPx}px` }}>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                            {expandedFields.map((field) => {
                                const value = getFieldValue(node, field.key, fallbacks);
                                const renderAs = (field.renderAs || 'text') as DataFieldKind;

                                return (
                                    <div key={field.key}>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            {field.label}
                                        </div>
                                        <DataFieldWidget kind={renderAs} value={value} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Children (subtasks) - rendered when expanded */}
                {enableNesting && isChildrenExpanded && nodeChildren.length > 0 && (
                    <div className="border-l-2 border-slate-200 ml-4">
                        {nodeChildren.map((child) => renderRow(child, depth + 1, effectiveSubtaskFields.filter((f) => f.showInCollapsed !== false && f.key !== 'title')))}
                        {/* Add subtask button */}
                        {onAddSubtask && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddSubtask(node.id);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                                style={{ paddingLeft: `${12 + (depth + 1) * 24}px` }}
                            >
                                <Plus size={12} />
                                <span>Add subtask</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Render footer with status summary aligned to status column
    const renderFooter = () => {
        if (!showStatusSummary || nodes.length === 0) return null;

        // Convert statusCounts to array format for StatusColumnSummary
        const statusCountsArray = Object.entries(statusCounts).map(([status, count]) => ({
            status,
            count,
        }));

        // Build color config from statusConfig prop (only if provided)
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
            : undefined; // Let StatusColumnSummary use its defaults

        return (
            <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-slate-50">
                <div className="flex h-10 items-center">
                    {/* Expand toggle column placeholder */}
                    {expandedFields.length > 0 && <div className="w-8 shrink-0" />}

                    {/* Title column - show total count */}
                    <div className="w-[280px] min-w-[150px] shrink-0 px-3">
                        <span className="text-xs font-semibold text-slate-600">
                            {nodes.length} item{nodes.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Dynamic columns - show status summary in status column */}
                    {collapsedFields.map((field) => {
                        const width = typeof field.width === 'number' ? field.width : 130;

                        // Render status counts only under status column
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

                        // Empty placeholder for non-status columns
                        return <div key={field.key} className="px-2" style={{ width }} />;
                    })}

                    <div className="flex-1" />
                </div>
            </div>
        );
    };

    return (
        <div className={clsx('flex flex-col border border-slate-200 rounded-lg overflow-hidden', className)}>
            {/* Header */}
            {renderHeader()}

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                {sortedNodes.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                        {emptyMessage}
                    </div>
                ) : (
                    sortedNodes.map((node) => renderRow(node, 0))
                )}
            </div>

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

            {/* Footer */}
            {renderFooter()}
        </div>
    );
}
