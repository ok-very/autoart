import { useMemo, useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { DataTable, type TableColumn } from './DataTable';
import { DataFieldWidget, type DataFieldKind } from '../common/DataFieldWidget';
import type { HierarchyNode, FieldDef } from '../../types';
import { useUpdateNode } from '../../api/hooks';
import {
    parseTaskMetadata,
    deriveTaskStatus,
    coercePercentComplete,
    isActiveStatus,
    TASK_STATUS_CONFIG,
    type TaskStatus,
    type TaskFieldDef,
    type TaskMetadata,
} from '../../utils/nodeMetadata';

// ==================== TYPES ====================

export interface TaskDataTableProps {
    /** Array of task nodes */
    tasks: HierarchyNode[];
    /** Field definitions from schema */
    fields: TaskFieldDef[];
    /** Fallback values from parent (subprocess) */
    fallbacks?: { owner?: string; dueDate?: string };
    /** Currently selected task ID */
    selectedTaskId?: string | null;
    /** Selection handler */
    onSelectTask?: (taskId: string) => void;
    /** Handler to open create task drawer */
    onAddTask?: () => void;
    /** Custom className */
    className?: string;
    /** Whether to show status summary footer */
    showStatusSummary?: boolean;
}

// ==================== HELPERS ====================

/**
 * Extract metadata from a node, parsing JSON string if needed
 */
function getNodeMetadata(node: HierarchyNode): Record<string, unknown> {
    if (typeof node.metadata === 'string') {
        try {
            const parsed = JSON.parse(node.metadata);
            return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
        } catch {
            return {};
        }
    }
    return (node.metadata as Record<string, unknown>) || {};
}

/**
 * Get display value for a field from task node
 */
function getFieldValue(
    field: TaskFieldDef,
    task: HierarchyNode,
    meta: TaskMetadata,
    fallbacks: { owner?: string; dueDate?: string },
    rawMetadata: Record<string, unknown>
): unknown {
    const key = field.key;

    // Special handling for certain fields
    if (key === 'title') return task.title;
    if (key === 'description') return task.description;
    if (key === 'status') return deriveTaskStatus(meta);
    if (key === 'percentComplete') {
        const status = deriveTaskStatus(meta);
        if (!isActiveStatus(status)) return null;
        return coercePercentComplete(meta);
    }
    if (key === 'owner') return meta.owner || fallbacks.owner || null;
    if (key === 'dueDate') return meta.dueDate || fallbacks.dueDate || null;
    if (key === 'tags') return meta.tags || [];

    // Generic metadata lookup - check raw metadata for custom fields
    return rawMetadata[key] ?? meta[key as keyof TaskMetadata] ?? null;
}

// ==================== TASK DATA TABLE ====================

/**
 * TaskDataTable - A specialized DataTable for task nodes
 *
 * Features:
 * - Schema-driven columns from TaskFieldDef
 * - Inline editing with automatic API save
 * - Status summary footer
 * - Expansion for additional fields
 */
export function TaskDataTable({
    tasks,
    fields,
    fallbacks = {},
    selectedTaskId,
    onSelectTask,
    onAddTask,
    className,
    showStatusSummary = true,
}: TaskDataTableProps) {
    const updateNode = useUpdateNode();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Filter fields for collapsed view (shown as columns)
    const collapsedFields = useMemo(
        () => fields.filter((f) => f.showInCollapsed && f.key !== 'title'),
        [fields]
    );

    // Filter fields for expanded view
    const expandedFields = useMemo(
        () => fields.filter((f) => f.showInExpanded && !f.showInCollapsed),
        [fields]
    );

    // Build columns from fields
    const columns = useMemo<TableColumn<HierarchyNode>[]>(() => {
        // Title column (always first, special rendering)
        const titleColumn: TableColumn<HierarchyNode> = {
            key: 'title',
            label: 'Task',
            width: 280,
            minWidth: 150,
            sortable: true,
            editable: true,
            resizable: true,
            field: { key: 'title', type: 'text', label: 'Task' },
            renderCell: (task) => (
                <div className="text-sm font-semibold text-slate-800 truncate" title={task.title}>
                    {task.title}
                </div>
            ),
        };

        // Dynamic columns from schema
        const fieldColumns = collapsedFields.map((field): TableColumn<HierarchyNode> => {
            const width = typeof field.width === 'number' ? field.width : 130;

            // Special rendering for status + percent combo
            if (field.key === 'status') {
                return {
                    key: field.key,
                    label: field.label,
                    width,
                    minWidth: 80,
                    field: field as FieldDef & { renderAs?: string },
                    sortable: true,
                    editable: true,
                    resizable: true,
                    align: 'center',
                    renderCell: (task) => {
                        const raw = getNodeMetadata(task);
                        const meta = parseTaskMetadata(raw);
                        const status = deriveTaskStatus(meta);
                        const percentComplete = isActiveStatus(status) ? coercePercentComplete(meta) : null;

                        return (
                            <div className="flex flex-col items-stretch gap-1">
                                <DataFieldWidget kind="status" value={status} />
                                {percentComplete != null && (
                                    <div className="px-1">
                                        <DataFieldWidget kind="percent" value={percentComplete} />
                                    </div>
                                )}
                            </div>
                        );
                    },
                };
            }

            return {
                key: field.key,
                label: field.label,
                width,
                minWidth: 60,
                field: field as FieldDef & { renderAs?: string },
                sortable: ['text', 'number', 'date', 'status', 'user'].includes(field.type),
                editable: true,
                resizable: true,
                align: field.type === 'number' || field.type === 'percent' ? 'right' : 'center',
                renderCell: (task) => {
                    const raw = getNodeMetadata(task);
                    const meta = parseTaskMetadata(raw);
                    const value = getFieldValue(field, task, meta, fallbacks, raw);
                    const renderAs = (field.renderAs || 'text') as DataFieldKind;
                    return <DataFieldWidget kind={renderAs} value={value} />;
                },
            };
        });

        return [titleColumn, ...fieldColumns];
    }, [collapsedFields, fallbacks]);

    // Handle cell value changes - update node via API
    const handleCellChange = useCallback(
        (taskId: string, key: string, value: unknown) => {
            const task = tasks.find((t) => t.id === taskId);
            if (!task) return;

            // Special handling for 'title' - update directly on node
            if (key === 'title') {
                updateNode.mutate({ id: taskId, title: String(value) });
                return;
            }

            // Special handling for 'description'
            if (key === 'description') {
                updateNode.mutate({ id: taskId, description: value });
                return;
            }

            // All other fields go into metadata
            const currentMeta = getNodeMetadata(task);
            const updatedMeta = { ...currentMeta, [key]: value };

            updateNode.mutate({ id: taskId, metadata: updatedMeta });
        },
        [tasks, updateNode]
    );

    // Handle row expansion toggle
    const handleToggleExpand = useCallback((taskId: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    }, []);

    // Render expanded row content
    const renderExpandedRow = useCallback(
        (task: HierarchyNode) => {
            const raw = getNodeMetadata(task);
            const meta = parseTaskMetadata(raw);
            const status = deriveTaskStatus(meta);
            const percentComplete = isActiveStatus(status) ? coercePercentComplete(meta) : null;

            return (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {expandedFields.map((field) => {
                        const value = getFieldValue(field, task, meta, fallbacks, raw);
                        const renderAs = (field.renderAs || 'text') as DataFieldKind;

                        if (field.key === 'status') {
                            return (
                                <div key={field.key}>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                        {field.label}
                                    </div>
                                    <div className="flex flex-col items-stretch gap-1">
                                        <DataFieldWidget kind="status" value={value} />
                                        {percentComplete != null && (
                                            <div className="px-1">
                                                <DataFieldWidget kind="percent" value={percentComplete} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

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
            );
        },
        [expandedFields, fallbacks]
    );

    // Compute status counts for footer
    const statusCounts = useMemo(() => {
        const counts: Partial<Record<TaskStatus, number>> = {};
        for (const task of tasks) {
            const raw = getNodeMetadata(task);
            const meta = parseTaskMetadata(raw);
            const s = deriveTaskStatus(meta);
            counts[s] = (counts[s] || 0) + 1;
        }
        return counts;
    }, [tasks]);

    // Render status summary footer
    const renderFooter = useCallback(() => {
        if (!showStatusSummary || tasks.length === 0) return null;

        const orderedStatuses = Object.keys(TASK_STATUS_CONFIG) as TaskStatus[];

        return (
            <div className="flex h-10 items-center">
                <div className="w-8" />
                <div className="w-[340px] px-2">
                    <span className="text-xs font-semibold text-slate-600">
                        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                    </span>
                </div>
                {collapsedFields.map((field) => {
                    const width = typeof field.width === 'number' ? `${field.width}px` : 'auto';

                    if (field.key === 'status') {
                        return (
                            <div key={field.key} className="px-2" style={{ width }}>
                                <div className="flex items-center gap-1.5 justify-center">
                                    {orderedStatuses.map((s) => {
                                        const count = statusCounts[s] || 0;
                                        if (count === 0) return null;
                                        const cfg = TASK_STATUS_CONFIG[s];
                                        return (
                                            <div key={s} className="flex items-center gap-1">
                                                <span className={clsx('w-2 h-2 rounded-full', cfg.colorClass)} />
                                                <span className="text-[10px] font-semibold text-slate-600 tabular-nums">
                                                    {count}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    return <div key={field.key} className="px-2" style={{ width }} />;
                })}
                <div className="flex-1" />
            </div>
        );
    }, [showStatusSummary, tasks.length, collapsedFields, statusCounts]);

    return (
        <DataTable<HierarchyNode>
            data={tasks}
            columns={columns}
            getRowKey={(task) => task.id}
            selectedRowId={selectedTaskId}
            onRowSelect={(id) => onSelectTask?.(id)}
            onCellChange={handleCellChange}
            expandable={expandedFields.length > 0}
            expandedRowIds={expandedIds}
            onToggleExpand={handleToggleExpand}
            renderExpandedRow={renderExpandedRow}
            showAddButton={!!onAddTask}
            onAddRow={onAddTask}
            emptyMessage="No tasks yet."
            className={className}
            stickyHeader
            stickyFooter={showStatusSummary}
            renderFooter={renderFooter}
        />
    );
}
