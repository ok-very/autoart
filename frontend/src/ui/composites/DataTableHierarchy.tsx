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
}: DataTableHierarchyProps) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

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

    // Compute status counts for footer
    const statusCounts = useMemo(() => {
        if (!deriveStatus || !showStatusSummary) return {};

        const counts: Record<string, number> = {};
        for (const node of nodes) {
            const status = deriveStatus(node);
            counts[status] = (counts[status] || 0) + 1;
        }
        return counts;
    }, [nodes, deriveStatus, showStatusSummary]);

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

    // Render a single row
    const renderRow = (node: HierarchyNode) => {
        const isSelected = node.id === selectedNodeId;
        const isExpanded = expandedIds.has(node.id);
        const status = deriveStatus?.(node);

        return (
            <div key={node.id}>
                {/* Main row */}
                <div
                    className={clsx(
                        'flex items-center border-b border-slate-100 cursor-pointer transition-colors',
                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    )}
                    onClick={() => onRowSelect?.(node.id)}
                >
                    {/* Expand toggle */}
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

                    {/* Title cell */}
                    <div className="w-[280px] min-w-[150px] shrink-0 px-3 py-2">
                        <EditableCell
                            viewModel={buildCellViewModel({ key: 'title', label: 'Title', type: 'text' }, node)}
                            onSave={(value) => onCellChange?.(node.id, 'title', value)}
                        />
                    </div>

                    {/* Dynamic cells */}
                    {collapsedFields.map((field) => {
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

                {/* Expanded content */}
                {isExpanded && expandedFields.length > 0 && (
                    <div className="px-12 py-3 bg-slate-50 border-b border-slate-200">
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
            </div>
        );
    };

    // Render footer with status summary
    const renderFooter = () => {
        if (!showStatusSummary || nodes.length === 0) return null;

        return (
            <div className="flex h-10 items-center border-t border-slate-200 bg-slate-50 px-3">
                <span className="text-xs font-semibold text-slate-600">
                    {nodes.length} item{nodes.length !== 1 ? 's' : ''}
                </span>

                {Object.keys(statusCounts).length > 0 && (
                    <div className="flex items-center gap-3 ml-4">
                        {Object.entries(statusCounts).map(([status, count]) => {
                            const config = statusConfig[status];
                            return (
                                <div key={status} className="flex items-center gap-1">
                                    <span className={clsx('w-2 h-2 rounded-full', config?.colorClass || 'bg-slate-400')} />
                                    <span className="text-[10px] font-semibold text-slate-600">
                                        {config?.label || status}: {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
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
                    sortedNodes.map(renderRow)
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
