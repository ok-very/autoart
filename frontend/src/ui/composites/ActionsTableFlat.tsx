/**
 * ActionsTableFlat - Reusable table composite for Action data
 *
 * This is a REUSABLE COMPOSITE for Action[] with RecordDefinition (action_recipe) schemas.
 * It does NOT fetch data - data is passed in as props.
 *
 * Companion to DataTableFlat, but for actions (first-class entities).
 *
 * Features:
 * - Dynamic columns with human-readable field binding display
 * - Row selection (click to inspect)
 * - Pagination
 * - Context and type badges
 * - Clean separation between action types
 */

import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { Plus, Zap, Clock, Tag } from 'lucide-react';
import { UniversalTableCore, makeFlatRowModel, type TableColumn as CoreTableColumn, type TableRow } from '../table-core';
import type { RecordDefinition } from '../../types';
import type { Action } from '@autoart/shared';

// ==================== TYPES ====================

export interface ActionsTableFlatProps {
    /** Actions to display */
    actions: Action[];
    /** Action recipe definition (for schema/display info) */
    definition: RecordDefinition | null;
    /** Loading state */
    isLoading?: boolean;
    /** Currently selected action ID */
    selectedActionId?: string | null;
    /** Callback when an action row is clicked */
    onRowSelect?: (actionId: string) => void;
    /** Callback to create a new action */
    onAddAction?: () => void;
    /** Page size for pagination */
    pageSize?: number;
    /** Compact display mode */
    compact?: boolean;
    /** Empty state message */
    emptyMessage?: string;
    /** Custom header content */
    renderHeader?: () => React.ReactNode;
    /** Custom footer content */
    renderFooter?: (info: { totalActions: number; page: number; totalPages: number }) => React.ReactNode;
    /** Additional className */
    className?: string;
}

// ==================== HELPERS ====================

/**
 * Extract a human-readable title from action field bindings
 */
function getActionTitle(action: Action): string {
    const bindings = action.fieldBindings || [];
    const titleBinding = bindings.find((b: { fieldKey: string; value?: unknown }) => b.fieldKey === 'title');
    if (titleBinding?.value && typeof titleBinding.value === 'string') {
        return titleBinding.value;
    }
    return `${action.type} ${action.id.slice(0, 8)}`;
}

/**
 * Format date to human-readable string
 */
function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/**
 * Format time ago
 */
function formatTimeAgo(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(d);
}

// ==================== ACTIONS TABLE FLAT ====================

/**
 * ActionsTableFlat - Table composite for Action data
 */
export function ActionsTableFlat({
    actions,
    definition,
    isLoading = false,
    selectedActionId,
    onRowSelect,
    onAddAction,
    pageSize = 50,
    compact = false,
    emptyMessage = 'No actions found',
    renderHeader,
    renderFooter,
    className,
}: ActionsTableFlatProps) {
    // Internal state
    const [page, setPage] = useState(0);

    // Paginate actions
    const paginatedActions = useMemo(() => {
        const start = page * pageSize;
        return actions.slice(start, start + pageSize);
    }, [actions, page, pageSize]);

    const totalPages = Math.ceil(actions.length / pageSize);

    // Handlers
    const handleRowClick = useCallback((actionId: string) => {
        onRowSelect?.(actionId);
    }, [onRowSelect]);

    // Build core columns with human-readable styling
    const coreColumns = useMemo<CoreTableColumn[]>(() => {
        return [
            // Title column - extracted from field bindings
            {
                id: 'title',
                header: 'Title',
                width: 280,
                minWidth: 150,
                resizable: true,
                sortKey: (row: TableRow) => {
                    const action = row.data as Action;
                    return getActionTitle(action);
                },
                cell: (row: TableRow) => {
                    const action = row.data as Action;
                    const title = getActionTitle(action);
                    const icon = definition?.styling?.icon;

                    return (
                        <div className="flex items-center gap-2">
                            {icon && <span className="text-base">{icon}</span>}
                            <span className="text-sm font-medium text-slate-800 truncate">
                                {title}
                            </span>
                        </div>
                    );
                },
            },
            // Type column - badge display
            {
                id: 'type',
                header: 'Type',
                width: 120,
                minWidth: 80,
                resizable: true,
                sortKey: (row: TableRow) => (row.data as Action).type,
                cell: (row: TableRow) => {
                    const action = row.data as Action;
                    return (
                        <div className="flex items-center gap-1">
                            <Zap size={12} className="text-purple-500" />
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-100 rounded">
                                {action.type}
                            </span>
                        </div>
                    );
                },
            },
            // Context column - human-readable context type
            {
                id: 'context',
                header: 'Context',
                width: 120,
                minWidth: 80,
                resizable: true,
                sortKey: (row: TableRow) => (row.data as Action).contextType,
                cell: (row: TableRow) => {
                    const action = row.data as Action;
                    const contextLabels: Record<string, string> = {
                        subprocess: 'Subprocess',
                        stage: 'Stage',
                        process: 'Process',
                        project: 'Project',
                        record: 'Record',
                    };
                    return (
                        <span className="text-xs text-slate-500 capitalize">
                            {contextLabels[action.contextType] || action.contextType}
                        </span>
                    );
                },
            },
            // Field bindings preview - human-readable summary
            {
                id: 'bindings',
                header: 'Fields',
                width: 200,
                minWidth: 100,
                resizable: true,
                cell: (row: TableRow) => {
                    const action = row.data as Action;
                    const bindings = action.fieldBindings || [];
                    const nonTitleBindings = bindings.filter((b: { fieldKey: string; value?: unknown }) => b.fieldKey !== 'title');

                    if (nonTitleBindings.length === 0) {
                        return <span className="text-xs text-slate-300">—</span>;
                    }

                    // Show first 2 bindings with labels
                    const preview = nonTitleBindings.slice(0, 2).map((b: { fieldKey: string; value?: unknown }) => {
                        const value = b.value;
                        const displayValue = typeof value === 'string'
                            ? value.length > 20 ? value.slice(0, 20) + '…' : value
                            : String(value ?? '');
                        return (
                            <span key={b.fieldKey} className="inline-flex items-center gap-1 mr-2">
                                <Tag size={10} className="text-slate-300" />
                                <span className="text-[10px] text-slate-400">{b.fieldKey}:</span>
                                <span className="text-[10px] text-slate-600">{displayValue}</span>
                            </span>
                        );
                    });

                    return (
                        <div className="flex items-center flex-wrap gap-1 overflow-hidden">
                            {preview}
                            {nonTitleBindings.length > 2 && (
                                <span className="text-[10px] text-slate-400">
                                    +{nonTitleBindings.length - 2} more
                                </span>
                            )}
                        </div>
                    );
                },
            },
            // Created column - human-readable time
            {
                id: 'created',
                header: 'Created',
                width: 100,
                minWidth: 80,
                resizable: true,
                align: 'right',
                sortKey: (row: TableRow) => {
                    const action = row.data as Action;
                    return action.createdAt ? new Date(action.createdAt).getTime() : 0;
                },
                cell: (row: TableRow) => {
                    const action = row.data as Action;
                    if (!action.createdAt) {
                        return <span className="text-xs text-slate-300">—</span>;
                    }
                    return (
                        <div className="flex items-center justify-end gap-1">
                            <Clock size={10} className="text-slate-300" />
                            <span className="text-xs text-slate-500" title={formatDate(action.createdAt)}>
                                {formatTimeAgo(action.createdAt)}
                            </span>
                        </div>
                    );
                },
            },
        ];
    }, [definition]);

    // Row model from paginated actions
    const rowModel = useMemo(() => {
        return makeFlatRowModel(paginatedActions);
    }, [paginatedActions]);

    // Get row class for selection highlighting
    const getRowClassName = useCallback((row: TableRow) => {
        const action = row.data as Action;
        const isActive = selectedActionId === action.id;
        if (isActive) return 'bg-purple-50 border-l-2 border-purple-500';
        return 'hover:bg-slate-50';
    }, [selectedActionId]);

    // Default footer with pagination
    const defaultFooter = useCallback(() => {
        if (renderFooter) {
            return renderFooter({
                totalActions: actions.length,
                page,
                totalPages,
            });
        }

        return (
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                    {actions.length} action{actions.length !== 1 ? 's' : ''}
                    {definition && <> of type <strong>{definition.name}</strong></>}
                </span>
                {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <span className="text-xs text-slate-500">
                            Page {page + 1} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        );
    }, [actions.length, definition, page, totalPages, renderFooter]);

    // Loading state
    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center h-64 text-slate-400', className)}>
                <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-purple-500 rounded-full" />
            </div>
        );
    }

    // Empty state - no definition
    if (!definition) {
        return (
            <div className={clsx('flex flex-col items-center justify-center h-64 text-slate-400', className)}>
                <Zap size={32} className="mb-2 text-slate-300" />
                <p className="text-lg font-medium">Select an action type</p>
                <p className="text-sm">Choose an action type from the sidebar to view instances</p>
            </div>
        );
    }

    // Empty state - no actions
    if (actions.length === 0) {
        return (
            <div className={clsx('flex flex-col items-center justify-center h-64 text-slate-400', className)}>
                <Zap size={32} className="mb-2 text-purple-200" />
                <p className="text-lg font-medium">{emptyMessage}</p>
                <p className="text-sm mb-4">Create your first {definition?.name || 'action'} using the Composer</p>
                {onAddAction && (
                    <button
                        onClick={onAddAction}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
                    >
                        <Plus size={14} />
                        Create {definition?.name || 'Action'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={clsx('flex flex-col h-full bg-white', className)}>
            {/* Custom header */}
            {renderHeader && renderHeader()}

            {/* Core table */}
            <UniversalTableCore
                rowModel={rowModel}
                columns={coreColumns}
                onRowClick={handleRowClick}
                getRowClassName={getRowClassName}
                stickyHeader
                stickyFooter
                compact={compact}
                renderFooter={defaultFooter}
            />

            {/* Add Action button */}
            {onAddAction && actions.length > 0 && (
                <button
                    onClick={onAddAction}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-colors border-t border-slate-200"
                >
                    <Plus size={14} />
                    <span>Add {definition?.name || 'Action'}</span>
                </button>
            )}
        </div>
    );
}
