/**
 * UniversalTableCore - The unified table rendering engine
 *
 * This is a presentation-only component that:
 * - Renders rows from a RowModel
 * - Handles column resize via drag
 * - Manages sort state (only for columns with sortKey)
 * - Displays loading/empty/error states
 * - Supports sticky header/footer
 * - Delegates cell rendering to wrapper-provided functions
 *
 * Key principle: Core does NOT know about FieldViewModel, EditableCell, or domain types.
 * Wrappers provide cell(row) functions that return ReactNodes.
 */

import { clsx } from 'clsx';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';

import type { TableFeature, TableCtx } from './features';
import { applyColumnDecorators, applyRowDecorators } from './features';
import type { TableColumn, TableRow, RowModel, RowId, SortState } from './types';

// ============================================================================
// COLUMN RESIZE HANDLE
// ============================================================================

interface ColumnResizeHandleProps {
    onResize: (delta: number) => void;
}

function ColumnResizeHandle({ onResize }: ColumnResizeHandleProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setStartX(e.clientX);
    }, []);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;
            onResize(delta);
            setStartX(e.clientX);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, startX, onResize]);

    return (
        <div
            onMouseDown={handleMouseDown}
            className={clsx(
                'absolute right-0 top-0 h-full w-1 cursor-col-resize group z-10',
                'hover:bg-blue-400',
                isDragging && 'bg-blue-500'
            )}
        >
            <div
                className={clsx(
                    'absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full transition-colors',
                    isDragging ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-blue-400'
                )}
            />
        </div>
    );
}

// ============================================================================
// PROPS
// ============================================================================

export interface UniversalTableCoreProps {
    /** Row model providing the data */
    rowModel: RowModel;
    /** Column definitions */
    columns: TableColumn[];
    /** Optional features for toolbar/column decoration */
    features?: TableFeature[];

    // State props
    /** Show loading state */
    isLoading?: boolean;
    /** Error to display */
    error?: unknown;
    /** Custom empty state content */
    emptyState?: React.ReactNode;
    /** Custom loading state content */
    loadingState?: React.ReactNode;
    /** Custom error state content */
    errorState?: React.ReactNode;

    // Interaction callbacks
    /** Called when a row is clicked */
    onRowClick?: (rowId: RowId) => void;
    /** Called when a row is double-clicked */
    onRowDoubleClick?: (rowId: RowId) => void;
    /** Get className for a row */
    getRowClassName?: (row: TableRow) => string;

    // Layout options
    /** Sticky header */
    stickyHeader?: boolean;
    /** Sticky footer */
    stickyFooter?: boolean;
    /** Compact row height */
    compact?: boolean;
    /** Custom footer renderer */
    renderFooter?: () => React.ReactNode;
    /** Additional className */
    className?: string;

    // Column resize persistence
    /** Called when a column is resized */
    onColumnResize?: (columnId: string, newWidth: number) => void;
}

// ============================================================================
// UNIVERSAL TABLE CORE
// ============================================================================

export function UniversalTableCore({
    rowModel,
    columns: columnsProp,
    features = [],
    isLoading = false,
    error,
    emptyState,
    loadingState,
    errorState,
    onRowClick,
    onRowDoubleClick,
    getRowClassName,
    stickyHeader = true,
    stickyFooter = false,
    compact = false,
    renderFooter,
    className,
    onColumnResize,
}: UniversalTableCoreProps) {
    // =========== STATE ===========

    const [sortState, setSortState] = useState<SortState>(null);
    const [columnWidths, setColumnWidths] = useState<Map<string, number | 'flex'>>(() => {
        const map = new Map<string, number | 'flex'>();
        columnsProp.forEach((col) => {
            map.set(col.id, col.width ?? 'flex');
        });
        return map;
    });

    // Update column widths when columns prop changes
    useEffect(() => {
        setColumnWidths((prev) => {
            const map = new Map<string, number | 'flex'>();
            columnsProp.forEach((col) => {
                map.set(col.id, prev.get(col.id) ?? col.width ?? 'flex');
            });
            return map;
        });
    }, [columnsProp]);

    // =========== CONTEXT ===========

    const ctx: TableCtx = useMemo(() => ({
        rowModel,
        columns: columnsProp,
    }), [rowModel, columnsProp]);

    // =========== COLUMNS WITH FEATURES ===========

    const decoratedColumns = useMemo(() => {
        return applyColumnDecorators(columnsProp, features, ctx);
    }, [columnsProp, features, ctx]);

    // =========== SORTING ===========

    const handleSort = useCallback((columnId: string) => {
        setSortState((prev) => {
            if (prev?.columnId === columnId) {
                if (prev.direction === 'asc') {
                    return { columnId, direction: 'desc' };
                }
                return null; // Clear sort
            }
            return { columnId, direction: 'asc' };
        });
    }, []);

    const sortedRows = useMemo(() => {
        const rows = rowModel.getRows();
        if (!sortState) return rows;

        const sortColumn = decoratedColumns.find((c) => c.id === sortState.columnId);
        if (!sortColumn?.sortKey) return rows;

        return [...rows].sort((a, b) => {
            const aVal = sortColumn.sortKey!(a);
            const bVal = sortColumn.sortKey!(b);

            // Null handling
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // Comparison
            let comparison = 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                comparison = aVal.localeCompare(bVal);
            } else if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            } else {
                comparison = String(aVal).localeCompare(String(bVal));
            }

            return sortState.direction === 'asc' ? comparison : -comparison;
        });
    }, [rowModel, sortState, decoratedColumns]);

    // =========== RESIZE ===========

    const handleColumnResize = useCallback(
        (columnId: string, delta: number) => {
            setColumnWidths((prev) => {
                const currentWidth = prev.get(columnId);
                if (typeof currentWidth !== 'number') return prev;

                const column = decoratedColumns.find((c) => c.id === columnId);
                const minWidth = column?.minWidth ?? 50;
                const newWidth = Math.max(minWidth, currentWidth + delta);

                const newMap = new Map(prev);
                newMap.set(columnId, newWidth);
                onColumnResize?.(columnId, newWidth);
                return newMap;
            });
        },
        [decoratedColumns, onColumnResize]
    );

    // =========== RENDER STATES ===========

    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center h-64 text-slate-400', className)}>
                {loadingState ?? (
                    <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full" />
                )}
            </div>
        );
    }

    if (error) {
        return (
            <div className={clsx('flex items-center justify-center h-64 text-red-500', className)}>
                {errorState ?? (
                    <div className="text-center">
                        <p className="font-medium">Error loading data</p>
                        <p className="text-sm text-slate-400">{String(error)}</p>
                    </div>
                )}
            </div>
        );
    }

    if (sortedRows.length === 0) {
        return (
            <div className={clsx('flex items-center justify-center h-64 text-slate-400', className)}>
                {emptyState ?? <p className="text-sm">No data available</p>}
            </div>
        );
    }

    // =========== MAIN RENDER ===========

    const rowHeight = compact ? 'h-8' : 'h-11';

    return (
        <div className={clsx('flex flex-col h-full overflow-hidden', className)}>
            {/* Toolbar from features */}
            {features.some((f) => f.renderToolbarLeft || f.renderToolbarRight) && (
                <div className="flex items-center justify-between px-2 py-1 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        {features.map((f) => f.renderToolbarLeft?.(ctx))}
                    </div>
                    <div className="flex items-center gap-2">
                        {features.map((f) => f.renderToolbarRight?.(ctx))}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <div
                    className={clsx(
                        'flex items-center bg-slate-50 border-b border-slate-200',
                        compact ? 'h-7' : 'h-9',
                        stickyHeader && 'sticky top-0 z-10'
                    )}
                >
                    {decoratedColumns.map((column) => {
                        const width = columnWidths.get(column.id) ?? column.width;
                        const widthStyle = typeof width === 'number' ? `${width}px` : undefined;
                        const isSorted = sortState?.columnId === column.id;
                        const isSortable = !!column.sortKey;
                        const isResizable = column.resizable !== false && typeof width === 'number';

                        return (
                            <div
                                key={column.id}
                                className={clsx(
                                    'relative px-3 flex items-center gap-1',
                                    column.align === 'center' && 'justify-center',
                                    column.align === 'right' && 'justify-end',
                                    isSortable && 'cursor-pointer hover:bg-slate-100'
                                )}
                                style={{ width: widthStyle, flex: width === 'flex' ? 1 : undefined }}
                                onClick={isSortable ? () => handleSort(column.id) : undefined}
                            >
                                {/* Custom header renderer or default text */}
                                {column.renderHeader ? (
                                    column.renderHeader()
                                ) : (
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                                        {column.header}
                                    </span>
                                )}
                                {isSortable && isSorted && (
                                    <span className="text-slate-400">
                                        {sortState.direction === 'asc' ? (
                                            <ChevronUp size={12} />
                                        ) : (
                                            <ChevronDown size={12} />
                                        )}
                                    </span>
                                )}
                                {isResizable && (
                                    <ColumnResizeHandle onResize={(delta) => handleColumnResize(column.id, delta)} />
                                )}
                            </div>
                        );
                    })}
                    <div className="flex-1" />
                </div>

                {/* Body */}
                <div>
                    {sortedRows.map((row) => {
                        // Apply row decorators from features
                        const decoratedRow = applyRowDecorators(row, features, ctx);
                        const customClassName = getRowClassName?.(decoratedRow) ?? '';

                        return (
                            <div
                                key={decoratedRow.id}
                                className={clsx(
                                    'flex items-center border-b border-slate-100 cursor-pointer transition-colors',
                                    'hover:bg-slate-50',
                                    rowHeight,
                                    customClassName
                                )}
                                onClick={() => onRowClick?.(decoratedRow.id)}
                                onDoubleClick={() => onRowDoubleClick?.(decoratedRow.id)}
                            >
                                {decoratedColumns.map((column) => {
                                    const width = columnWidths.get(column.id) ?? column.width;
                                    const widthStyle = typeof width === 'number' ? `${width}px` : undefined;

                                    return (
                                        <div
                                            key={column.id}
                                            className={clsx(
                                                'px-3 overflow-hidden',
                                                column.align === 'center' && 'text-center',
                                                column.align === 'right' && 'text-right'
                                            )}
                                            style={{ width: widthStyle, flex: width === 'flex' ? 1 : undefined }}
                                        >
                                            {column.cell(decoratedRow)}
                                        </div>
                                    );
                                })}
                                <div className="flex-1" />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            {renderFooter && (
                <div
                    className={clsx(
                        'bg-slate-50 border-t border-slate-200',
                        stickyFooter && 'sticky bottom-0 z-10'
                    )}
                >
                    {renderFooter()}
                </div>
            )}
        </div>
    );
}
