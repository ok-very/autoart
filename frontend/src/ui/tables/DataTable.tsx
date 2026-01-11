/**
 * @deprecated Use DataTableFlat or DataTableHierarchy from ui/composites instead.
 * This component uses the deprecated tables/EditableCell.
 */
import { clsx } from 'clsx';
import { ChevronUp, ChevronDown, Plus, GripVertical } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';

import { EditableCell } from './EditableCell';
import type { FieldDef } from '../../types';

// ==================== TYPES ====================

export interface TableColumn<T = unknown> {
    /** Unique column key (usually field.key) */
    key: string;
    /** Display label */
    label: string;
    /** Width in pixels or 'flex' */
    width?: number | 'flex';
    /** Minimum width when resizing */
    minWidth?: number;
    /** Field definition for editing */
    field?: FieldDef & { renderAs?: string };
    /** Whether column is sortable */
    sortable?: boolean;
    /** Whether column is resizable */
    resizable?: boolean;
    /** Whether column is editable */
    editable?: boolean;
    /** Custom render function for cell content */
    renderCell?: (row: T, column: TableColumn<T>) => React.ReactNode;
    /** Custom render function for header */
    renderHeader?: (column: TableColumn<T>) => React.ReactNode;
    /** Alignment */
    align?: 'left' | 'center' | 'right';
}

// ==================== COLUMN RESIZE HANDLE ====================

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

export interface DataTableProps<T> {
    /** Array of row data */
    data: T[];
    /** Column configuration derived from schema */
    columns: TableColumn<T>[];
    /** Unique key extractor for rows */
    getRowKey: (row: T) => string;
    /** Currently selected row ID */
    selectedRowId?: string | null;
    /** Row selection handler */
    onRowSelect?: (rowId: string, row: T) => void;
    /** Row double-click handler */
    onRowDoubleClick?: (rowId: string, row: T) => void;
    /** Cell value change handler - for inline editing */
    onCellChange?: (rowId: string, key: string, value: unknown) => void;
    /** Column resize handler */
    onColumnResize?: (columnKey: string, newWidth: number) => void;
    /** Whether rows are expandable */
    expandable?: boolean;
    /** Expanded row IDs */
    expandedRowIds?: Set<string>;
    /** Toggle row expansion */
    onToggleExpand?: (rowId: string) => void;
    /** Render function for expanded row content */
    renderExpandedRow?: (row: T) => React.ReactNode;
    /** Whether to show add row button in header */
    showAddButton?: boolean;
    /** Add row handler */
    onAddRow?: () => void;
    /** Table title */
    title?: string;
    /** Table icon (emoji) */
    icon?: string;
    /** Empty state message */
    emptyMessage?: string;
    /** Additional className for container */
    className?: string;
    /** Whether the table is compact */
    compact?: boolean;
    /** Whether to show row numbers */
    showRowNumbers?: boolean;
    /** Sticky header */
    stickyHeader?: boolean;
    /** Sticky footer */
    stickyFooter?: boolean;
    /** Footer render function */
    renderFooter?: () => React.ReactNode;
}

// ==================== COLUMN HEADER ====================

interface ColumnHeaderProps<T> {
    column: TableColumn<T>;
    columnWidth: number | 'flex';
    sortKey?: string;
    sortDir?: 'asc' | 'desc';
    onSort?: (key: string) => void;
    onResize?: (delta: number) => void;
}

function ColumnHeader<T>({ column, columnWidth, sortKey, sortDir, onSort, onResize }: ColumnHeaderProps<T>) {
    const isSorted = sortKey === column.key;
    const width = typeof columnWidth === 'number' ? `${columnWidth}px` : undefined;
    const align = column.align || 'left';
    const isResizable = column.resizable !== false && typeof columnWidth === 'number';

    const handleClick = () => {
        if (column.sortable && onSort) {
            onSort(column.key);
        }
    };

    if (column.renderHeader) {
        return (
            <div
                className="relative px-2"
                style={{ width, flex: columnWidth === 'flex' ? 1 : undefined }}
            >
                {column.renderHeader(column)}
                {isResizable && onResize && <ColumnResizeHandle onResize={onResize} />}
            </div>
        );
    }

    return (
        <div
            className={clsx(
                'relative px-2 flex items-center gap-1',
                column.sortable && 'cursor-pointer hover:bg-slate-100 rounded',
                align === 'center' && 'justify-center',
                align === 'right' && 'justify-end'
            )}
            style={{ width, flex: columnWidth === 'flex' ? 1 : undefined }}
            onClick={handleClick}
        >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                {column.label}
            </span>
            {column.sortable && isSorted && (
                <span className="text-slate-400">
                    {sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
            )}
            {isResizable && onResize && <ColumnResizeHandle onResize={onResize} />}
        </div>
    );
}

// ==================== TABLE ROW ====================

interface TableRowProps<T> {
    row: T;
    rowId: string;
    columns: TableColumn<T>[];
    columnWidths: Map<string, number | 'flex'>;
    isSelected: boolean;
    isExpanded?: boolean;
    onSelect: () => void;
    onDoubleClick?: () => void;
    onCellChange?: (key: string, value: unknown) => void;
    onToggleExpand?: () => void;
    expandable?: boolean;
    compact?: boolean;
    showRowNumber?: number;
    renderExpandedRow?: (row: T) => React.ReactNode;
    /** Value extractor function */
    getValue: (row: T, key: string) => unknown;
}

function TableRow<T>({
    row,
    rowId: _rowId,
    columns,
    columnWidths,
    isSelected,
    isExpanded,
    onSelect,
    onDoubleClick,
    onCellChange,
    onToggleExpand,
    expandable,
    compact,
    showRowNumber,
    renderExpandedRow,
    getValue,
}: TableRowProps<T>) {
    const rowHeight = compact ? 'h-8' : 'h-11';

    return (
        <div
            className={clsx(
                'border-b border-slate-100 transition-all',
                isSelected && 'bg-blue-50',
                isExpanded && 'bg-slate-50/50'
            )}
        >
            {/* Main Row */}
            <div
                className={clsx(
                    'flex items-center hover:bg-slate-50 cursor-pointer transition-colors',
                    rowHeight
                )}
                onClick={onSelect}
                onDoubleClick={onDoubleClick}
            >
                {/* Row number / expand toggle */}
                {(expandable || showRowNumber !== undefined) && (
                    <div className="w-8 flex items-center justify-center text-slate-400">
                        {expandable ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleExpand?.();
                                }}
                                className="hover:text-slate-600"
                            >
                                {isExpanded ? (
                                    <ChevronDown size={14} />
                                ) : (
                                    <GripVertical size={14} className="rotate-90" />
                                )}
                            </button>
                        ) : (
                            <span className="text-[10px]">{showRowNumber}</span>
                        )}
                    </div>
                )}

                {/* Data Cells */}
                {columns.map((column) => {
                    const value = getValue(row, column.key);
                    const colWidth = columnWidths.get(column.key) ?? column.width;
                    const width = typeof colWidth === 'number' ? `${colWidth}px` : undefined;

                    // Custom renderer takes precedence
                    if (column.renderCell) {
                        return (
                            <div
                                key={column.key}
                                className="px-2 overflow-hidden"
                                style={{ width, flex: colWidth === 'flex' ? 1 : undefined }}
                            >
                                {column.renderCell(row, column)}
                            </div>
                        );
                    }

                    // Use EditableCell if field is defined and editable
                    if (column.field && column.editable !== false) {
                        return (
                            <EditableCell
                                key={column.key}
                                field={{ ...column.field, width: colWidth }}
                                value={value}
                                onChange={(key, val) => onCellChange?.(key, val)}
                                editable={column.editable ?? true}
                                className={clsx(
                                    column.align === 'center' && 'justify-center',
                                    column.align === 'right' && 'justify-end'
                                )}
                            />
                        );
                    }

                    // Default: display-only cell
                    return (
                        <div
                            key={column.key}
                            className={clsx(
                                'px-2 text-sm text-slate-700 truncate overflow-hidden',
                                column.align === 'center' && 'text-center',
                                column.align === 'right' && 'text-right'
                            )}
                            style={{ width, flex: colWidth === 'flex' ? 1 : undefined }}
                        >
                            {String(value ?? '')}
                        </div>
                    );
                })}

                <div className="flex-1" />
            </div>

            {/* Expanded Content */}
            {isExpanded && renderExpandedRow && (
                <div className="pl-10 pr-4 pb-3 pt-1 bg-slate-50 border-t border-slate-100">
                    {renderExpandedRow(row)}
                </div>
            )}
        </div>
    );
}

// ==================== DATA TABLE ====================

/**
 * DataTable - A modular, schema-driven table component
 *
 * Features:
 * - Dynamic columns from field schema
 * - Inline editing with EditableCell
 * - Resizable columns with drag handles
 * - Sorting, expanding, selection
 * - Sticky header/footer
 * - Nestable design for sub-tables
 */
export function DataTable<T>({
    data,
    columns,
    getRowKey,
    selectedRowId,
    onRowSelect,
    onRowDoubleClick,
    onCellChange,
    onColumnResize,
    expandable = false,
    expandedRowIds,
    onToggleExpand,
    renderExpandedRow,
    showAddButton = false,
    onAddRow,
    title,
    icon,
    emptyMessage = 'No data',
    className,
    compact = false,
    showRowNumbers = false,
    stickyHeader = true,
    stickyFooter = false,
    renderFooter,
}: DataTableProps<T>) {
    // Sorting state
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Column widths state - initialize from columns
    const [columnWidths, setColumnWidths] = useState<Map<string, number | 'flex'>>(() => {
        const map = new Map<string, number | 'flex'>();
        columns.forEach((col) => {
            map.set(col.key, col.width ?? 'flex');
        });
        return map;
    });

    // Update column widths when columns prop changes
    useEffect(() => {
        setColumnWidths((prev) => {
            const map = new Map<string, number | 'flex'>();
            columns.forEach((col) => {
                // Keep existing width if set, otherwise use column default
                map.set(col.key, prev.get(col.key) ?? col.width ?? 'flex');
            });
            return map;
        });
    }, [columns]);

    // Handle column resize
    const handleColumnResize = useCallback(
        (columnKey: string, delta: number) => {
            setColumnWidths((prev) => {
                const currentWidth = prev.get(columnKey);
                if (typeof currentWidth !== 'number') return prev;

                const column = columns.find((c) => c.key === columnKey);
                const minWidth = column?.minWidth ?? 50;
                const newWidth = Math.max(minWidth, currentWidth + delta);

                const newMap = new Map(prev);
                newMap.set(columnKey, newWidth);
                onColumnResize?.(columnKey, newWidth);
                return newMap;
            });
        },
        [columns, onColumnResize]
    );

    // Value extractor - works with objects that have a 'data' property or direct properties
    const getValue = useCallback((row: T, key: string): unknown => {
        const r = row as Record<string, unknown>;
        // Check for nested data object first (for DataRecord pattern)
        if (r.data && typeof r.data === 'object') {
            const data = r.data as Record<string, unknown>;
            if (key in data) return data[key];
        }
        // Check for metadata object (for HierarchyNode pattern)
        if (r.metadata) {
            let meta = r.metadata;
            if (typeof meta === 'string') {
                try {
                    meta = JSON.parse(meta);
                } catch {
                    meta = {};
                }
            }
            if (typeof meta === 'object' && meta !== null) {
                const metaObj = meta as Record<string, unknown>;
                if (key in metaObj) return metaObj[key];
            }
        }
        // Direct property access
        return r[key];
    }, []);

    // Handle sort toggle
    const handleSort = useCallback((key: string) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    }, [sortKey]);

    // Sorted data
    const sortedData = useMemo(() => {
        if (!sortKey) return data;

        return [...data].sort((a, b) => {
            const aVal = getValue(a, sortKey);
            const bVal = getValue(b, sortKey);

            let comparison = 0;
            if (aVal == null && bVal == null) comparison = 0;
            else if (aVal == null) comparison = 1;
            else if (bVal == null) comparison = -1;
            else if (typeof aVal === 'string' && typeof bVal === 'string') {
                comparison = aVal.localeCompare(bVal);
            } else if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            } else {
                comparison = String(aVal).localeCompare(String(bVal));
            }

            return sortDir === 'asc' ? comparison : -comparison;
        });
    }, [data, sortKey, sortDir, getValue]);

    return (
        <div className={clsx('bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden', className)}>
            {/* Header with title */}
            {(title || showAddButton) && (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {icon && <span className="text-base">{icon}</span>}
                        {title && (
                            <>
                                <span className="text-sm font-semibold text-slate-700">{title}</span>
                                <span className="text-xs text-slate-400">({data.length})</span>
                            </>
                        )}
                    </div>
                    {showAddButton && (
                        <button
                            onClick={onAddRow}
                            className="text-xs px-2 py-1 rounded border border-slate-200 hover:border-slate-300 hover:bg-white text-slate-600 flex items-center gap-1"
                        >
                            <Plus size={12} />
                            Add
                        </button>
                    )}
                </div>
            )}

            {/* Column Headers */}
            <div
                className={clsx(
                    'flex items-center bg-slate-50/50 border-b border-slate-100',
                    compact ? 'h-7' : 'h-9',
                    stickyHeader && 'sticky top-0 z-10 bg-white'
                )}
            >
                {(expandable || showRowNumbers) && <div className="w-8" />}
                {columns.map((column) => (
                    <ColumnHeader
                        key={column.key}
                        column={column}
                        columnWidth={columnWidths.get(column.key) ?? column.width ?? 'flex'}
                        sortKey={sortKey || undefined}
                        sortDir={sortDir}
                        onSort={handleSort}
                        onResize={(delta) => handleColumnResize(column.key, delta)}
                    />
                ))}
                <div className="flex-1" />
            </div>

            {/* Rows */}
            {sortedData.length === 0 ? (
                <div className="p-6 text-sm text-slate-400 text-center">{emptyMessage}</div>
            ) : (
                <div>
                    {sortedData.map((row, index) => {
                        const rowId = getRowKey(row);
                        return (
                            <TableRow
                                key={rowId}
                                row={row}
                                rowId={rowId}
                                columns={columns}
                                columnWidths={columnWidths}
                                isSelected={selectedRowId === rowId}
                                isExpanded={expandedRowIds?.has(rowId)}
                                onSelect={() => onRowSelect?.(rowId, row)}
                                onDoubleClick={() => onRowDoubleClick?.(rowId, row)}
                                onCellChange={(key, val) => onCellChange?.(rowId, key, val)}
                                onToggleExpand={() => onToggleExpand?.(rowId)}
                                expandable={expandable}
                                compact={compact}
                                showRowNumber={showRowNumbers ? index + 1 : undefined}
                                renderExpandedRow={renderExpandedRow}
                                getValue={getValue}
                            />
                        );
                    })}
                </div>
            )}

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

// ==================== UTILITIES ====================

/**
 * Convert FieldDef array to TableColumn array
 * Use this to generate columns from a schema definition
 */
export function fieldsToColumns<T>(
    fields: (FieldDef & { renderAs?: string; width?: number | 'flex'; showInCollapsed?: boolean })[],
    options?: {
        editable?: boolean;
        filter?: (field: FieldDef) => boolean;
    }
): TableColumn<T>[] {
    const filtered = options?.filter ? fields.filter(options.filter) : fields;

    return filtered.map((field) => ({
        key: field.key,
        label: field.label,
        width: field.width,
        field: field,
        editable: options?.editable ?? true,
        sortable: ['text', 'number', 'date', 'status'].includes(field.type),
        align: field.type === 'number' || field.type === 'percent' ? 'right' as const : 'left' as const,
    }));
}
