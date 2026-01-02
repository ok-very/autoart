/**
 * DataTableFlat - Reusable table composite for flat DataRecord data
 *
 * This is a REUSABLE COMPOSITE for DataRecord[] with RecordDefinition schemas.
 * It does NOT fetch data - data is passed in as props.
 * Page-level views (RecordGrid) and ProjectWorkflowView (for classified records) use this.
 *
 * For HierarchyNode data (tasks, subprocesses), use DataTableHierarchy instead.
 *
 * Features:
 * - Dynamic columns from definition schema
 * - Inline editing via EditableCell
 * - Column visibility picker
 * - Sorting (internal state)
 * - Row selection with multi-select
 * - Pagination (internal state)
 * - Builds FieldViewModels for cells
 */

import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { ArrowUpDown, Columns, ChevronUp, ChevronDown } from 'lucide-react';
import { EditableCell } from '../molecules/EditableCell';
import { DataFieldWidget, type DataFieldKind } from '../molecules/DataFieldWidget';
import { buildFieldViewModel, type FieldViewModel, type FieldDefinition, type ProjectState, type EntityContext } from '@autoart/shared/domain';
import type { DataRecord, RecordDefinition, FieldDef } from '../../types';

// ==================== TYPES ====================

export interface TableColumn {
    /** Unique column key */
    key: string;
    /** Display label */
    label: string;
    /** Field definition (for editing) */
    field?: FieldDef;
    /** Column width in pixels */
    width?: number;
    /** Minimum width */
    minWidth?: number;
    /** Is column sortable */
    sortable?: boolean;
    /** Is column editable */
    editable?: boolean;
    /** Is column resizable */
    resizable?: boolean;
    /** Custom cell renderer (overrides default) */
    renderCell?: (record: DataRecord, viewModel: FieldViewModel) => React.ReactNode;
}

export interface DataTableFlatProps {
    /** Records to display */
    records: DataRecord[];
    /** Record definition (for column schema) */
    definition: RecordDefinition | null;
    /** Loading state */
    isLoading?: boolean;
    /** Currently selected record ID */
    selectedRecordId?: string | null;
    /** Callback when a record row is clicked */
    onRowSelect?: (recordId: string) => void;
    /** Callback when a cell value changes */
    onCellChange?: (recordId: string, fieldKey: string, value: unknown) => void;
    /** Callback when selection changes (multi-select) */
    onSelectionChange?: (selectedIds: Set<string>) => void;
    /** Column overrides/additions */
    columnOverrides?: Partial<Record<string, Partial<TableColumn>>>;
    /** Which columns to show (by key). If not provided, shows first 6 */
    visibleColumns?: string[];
    /** Whether inline editing is enabled */
    editable?: boolean;
    /** Whether multi-select is enabled */
    multiSelect?: boolean;
    /** Page size for pagination */
    pageSize?: number;
    /** Compact display mode */
    compact?: boolean;
    /** Empty state message */
    emptyMessage?: string;
    /** Custom header content (replaces default) */
    renderHeader?: () => React.ReactNode;
    /** Custom footer content */
    renderFooter?: (info: { totalRecords: number; page: number; totalPages: number; selectedIds: Set<string> }) => React.ReactNode;
    /** Additional className */
    className?: string;
}

type SortDirection = 'asc' | 'desc';
type SortConfig = { key: string; direction: SortDirection } | null;

// ==================== COLUMN VISIBILITY PICKER ====================

interface ColumnPickerProps {
    allColumns: TableColumn[];
    visibleKeys: Set<string>;
    onToggle: (key: string) => void;
}

function ColumnPicker({ allColumns, visibleKeys, onToggle }: ColumnPickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded hover:bg-slate-100 text-slate-500"
                title="Toggle columns"
            >
                <Columns size={16} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase">
                            Visible Columns
                        </div>
                        {allColumns.map((col) => (
                            <label
                                key={col.key}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={visibleKeys.has(col.key)}
                                    onChange={() => onToggle(col.key)}
                                    className="rounded border-slate-300"
                                />
                                <span className="truncate">{col.label}</span>
                            </label>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ==================== UNIVERSAL TABLE VIEW ====================

/**
 * Create minimal project state for building view models
 */
function createMinimalProjectState(): ProjectState {
    return {
        projectId: '',
        phase: 0,
        nodes: [],
        records: [],
        definitions: [],
        metadata: {},
    };
}

/**
 * DataTableFlat - Table composite for flat DataRecord data
 */
export function DataTableFlat({
    records,
    definition,
    isLoading = false,
    selectedRecordId,
    onRowSelect,
    onCellChange,
    onSelectionChange,
    columnOverrides = {},
    visibleColumns: visibleColumnsProp,
    editable = true,
    multiSelect = true,
    pageSize = 50,
    compact = false,
    emptyMessage = 'No records found',
    renderHeader,
    renderFooter,
    className,
}: DataTableFlatProps) {
    // Internal state
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [internalVisibleKeys, setInternalVisibleKeys] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(0);

    // Build columns from definition schema
    const allColumns = useMemo<TableColumn[]>(() => {
        // Name column (always present)
        const nameColumn: TableColumn = {
            key: 'unique_name',
            label: 'Name',
            width: 200,
            minWidth: 100,
            sortable: true,
            editable: editable,
            resizable: true,
            field: { key: 'unique_name', type: 'text', label: 'Name' },
        };

        // Dynamic columns from schema
        const fields = definition?.schema_config?.fields || [];
        const fieldColumns = fields.map((field: FieldDef): TableColumn => {
            let defaultWidth = 150;
            if (field.type === 'text') defaultWidth = 180;
            if (field.type === 'number' || field.type === 'percent') defaultWidth = 100;
            if (field.type === 'date') defaultWidth = 120;
            if (field.type === 'status' || field.type === 'select') defaultWidth = 130;
            if (field.type === 'user') defaultWidth = 140;
            if (field.type === 'tags') defaultWidth = 160;

            return {
                key: field.key,
                label: field.label,
                width: defaultWidth,
                minWidth: 80,
                field: field,
                sortable: ['text', 'number', 'date', 'status', 'select'].includes(field.type),
                editable: editable,
                resizable: true,
                ...columnOverrides[field.key],
            };
        });

        // Updated at column
        const updatedColumn: TableColumn = {
            key: 'updated_at',
            label: 'Updated',
            width: 100,
            minWidth: 80,
            sortable: true,
            editable: false,
            resizable: true,
        };

        return [nameColumn, ...fieldColumns, updatedColumn];
    }, [definition, editable, columnOverrides]);

    // Determine visible columns
    const visibleColumnKeys = useMemo(() => {
        if (visibleColumnsProp) {
            return new Set(visibleColumnsProp);
        }
        if (internalVisibleKeys.size > 0) {
            return internalVisibleKeys;
        }
        // Default: first 6 columns
        return new Set(allColumns.slice(0, 6).map((c) => c.key));
    }, [visibleColumnsProp, internalVisibleKeys, allColumns]);

    const displayColumns = useMemo(() => {
        return allColumns.filter((col) => visibleColumnKeys.has(col.key));
    }, [allColumns, visibleColumnKeys]);

    // Sort records
    const sortedRecords = useMemo(() => {
        if (!sortConfig) return records;

        return [...records].sort((a, b) => {
            let aVal: unknown;
            let bVal: unknown;

            if (sortConfig.key === 'unique_name') {
                aVal = a.unique_name;
                bVal = b.unique_name;
            } else if (sortConfig.key === 'updated_at') {
                aVal = a.updated_at;
                bVal = b.updated_at;
            } else {
                aVal = a.data?.[sortConfig.key];
                bVal = b.data?.[sortConfig.key];
            }

            if (aVal === undefined || aVal === null) return 1;
            if (bVal === undefined || bVal === null) return -1;

            const comparison = String(aVal).localeCompare(String(bVal));
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [records, sortConfig]);

    // Paginate
    const paginatedRecords = useMemo(() => {
        const start = page * pageSize;
        return sortedRecords.slice(start, start + pageSize);
    }, [sortedRecords, page, pageSize]);

    const totalPages = Math.ceil(sortedRecords.length / pageSize);

    // Handlers
    const handleSort = useCallback((key: string) => {
        setSortConfig((prev) => {
            if (prev?.key === key) {
                return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    }, []);

    const handleToggleColumn = useCallback((key: string) => {
        setInternalVisibleKeys((prev) => {
            const next = new Set(prev.size > 0 ? prev : visibleColumnKeys);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, [visibleColumnKeys]);

    const handleRowClick = useCallback((recordId: string) => {
        onRowSelect?.(recordId);
    }, [onRowSelect]);

    const handleSelectOne = useCallback((recordId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(recordId)) {
                next.delete(recordId);
            } else {
                next.add(recordId);
            }
            onSelectionChange?.(next);
            return next;
        });
    }, [onSelectionChange]);

    const handleSelectAll = useCallback(() => {
        setSelectedIds((prev) => {
            const allOnPage = new Set(paginatedRecords.map((r) => r.id));
            const allSelected = paginatedRecords.every((r) => prev.has(r.id));
            const next = allSelected ? new Set<string>() : allOnPage;
            onSelectionChange?.(next);
            return next;
        });
    }, [paginatedRecords, onSelectionChange]);

    const handleCellSave = useCallback((recordId: string, fieldId: string, value: unknown) => {
        onCellChange?.(recordId, fieldId, value);
    }, [onCellChange]);

    // Build FieldViewModel for a cell
    const buildCellViewModel = useCallback((record: DataRecord, column: TableColumn): FieldViewModel => {
        const projectState = createMinimalProjectState();
        const entityContext: EntityContext = {
            entityId: record.id,
            entityType: 'record',
            definitionId: record.definition_id,
        };

        let value: unknown;
        if (column.key === 'unique_name') {
            value = record.unique_name;
        } else if (column.key === 'updated_at') {
            value = record.updated_at;
        } else {
            value = record.data?.[column.key];
        }

        const fieldDef: FieldDefinition = {
            key: column.key,
            label: column.label,
            type: (column.field?.type || 'text') as FieldDefinition['type'],
            required: column.field?.required || false,
            options: column.field?.options,
            phase: 0,
        };

        const viewModel = buildFieldViewModel({
            field: fieldDef,
            value,
            projectState,
            entityContext,
        });

        // Override editable based on column config
        return {
            ...viewModel,
            editable: (column.editable ?? editable) && viewModel.editable,
        };
    }, [editable]);

    // Render cell content
    const renderCellContent = useCallback((record: DataRecord, column: TableColumn) => {
        const viewModel = buildCellViewModel(record, column);

        // Custom renderer
        if (column.renderCell) {
            return column.renderCell(record, viewModel);
        }

        // Updated at special handling
        if (column.key === 'updated_at') {
            const date = record.updated_at ? new Date(record.updated_at) : null;
            return (
                <div className="text-xs text-slate-500">
                    {date ? date.toLocaleDateString() : '-'}
                </div>
            );
        }

        // Editable cell
        if (column.editable && editable) {
            return (
                <EditableCell
                    viewModel={viewModel}
                    onSave={(fieldId, value) => handleCellSave(record.id, fieldId, value)}
                    width={column.width}
                />
            );
        }

        // Read-only display
        const renderAs = (column.field?.type || 'text') as DataFieldKind;
        return <DataFieldWidget kind={renderAs} value={viewModel.value} />;
    }, [buildCellViewModel, editable, handleCellSave]);

    // Loading state
    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center h-64 text-slate-400', className)}>
                <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full" />
            </div>
        );
    }

    // Empty state
    if (!definition) {
        return (
            <div className={clsx('flex flex-col items-center justify-center h-64 text-slate-400', className)}>
                <p className="text-lg font-medium">No definition</p>
                <p className="text-sm">Select a record type to view</p>
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <div className={clsx('flex flex-col items-center justify-center h-64 text-slate-400', className)}>
                <p className="text-lg font-medium">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className={clsx('flex flex-col h-full', className)}>
            {/* Optional header */}
            {renderHeader ? (
                renderHeader()
            ) : (
                <div className="flex items-center justify-end px-2 py-1 bg-slate-50 border-b border-slate-200">
                    <ColumnPicker
                        allColumns={allColumns}
                        visibleKeys={visibleColumnKeys}
                        onToggle={handleToggleColumn}
                    />
                </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                        <tr>
                            {/* Checkbox column */}
                            {multiSelect && (
                                <th className="w-10 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={paginatedRecords.length > 0 && paginatedRecords.every((r) => selectedIds.has(r.id))}
                                        onChange={handleSelectAll}
                                        className="rounded border-slate-300"
                                    />
                                </th>
                            )}

                            {/* Data columns */}
                            {displayColumns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                    className={clsx(
                                        'px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase',
                                        col.sortable && 'cursor-pointer hover:bg-slate-100'
                                    )}
                                    style={{ width: col.width, minWidth: col.minWidth }}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {sortConfig?.key === col.key && (
                                            sortConfig.direction === 'asc'
                                                ? <ChevronUp size={12} />
                                                : <ChevronDown size={12} />
                                        )}
                                        {col.sortable && sortConfig?.key !== col.key && (
                                            <ArrowUpDown size={10} className="text-slate-300" />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRecords.map((record) => {
                            const isSelected = selectedIds.has(record.id);
                            const isActive = selectedRecordId === record.id;

                            return (
                                <tr
                                    key={record.id}
                                    onClick={() => handleRowClick(record.id)}
                                    className={clsx(
                                        'border-b border-slate-100 cursor-pointer transition-colors',
                                        isActive && 'bg-blue-50',
                                        isSelected && !isActive && 'bg-blue-25',
                                        !isActive && !isSelected && 'hover:bg-slate-50'
                                    )}
                                >
                                    {/* Checkbox */}
                                    {multiSelect && (
                                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleSelectOne(record.id)}
                                                className="rounded border-slate-300"
                                            />
                                        </td>
                                    )}

                                    {/* Data cells */}
                                    {displayColumns.map((col) => (
                                        <td
                                            key={col.key}
                                            className={clsx(
                                                'px-3 text-sm',
                                                compact ? 'py-1' : 'py-2'
                                            )}
                                            style={{ width: col.width, minWidth: col.minWidth }}
                                        >
                                            {renderCellContent(record, col)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            {renderFooter ? (
                renderFooter({
                    totalRecords: sortedRecords.length,
                    page,
                    totalPages,
                    selectedIds,
                })
            ) : totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-500">
                        {sortedRecords.length} record{sortedRecords.length !== 1 ? 's' : ''}
                    </span>
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
                </div>
            )}
        </div>
    );
}
