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
 * - Sorting (delegated to UniversalTableCore)
 * - Row selection with multi-select
 * - Pagination (internal state)
 * - Builds FieldViewModels for cells
 *
 * Architecture:
 * - Uses UniversalTableCore for rendering
 * - Wrapper handles pagination, selection, column visibility
 * - Wrapper provides cell() functions with domain factory calls
 */

import { clsx } from 'clsx';
import { Columns, Plus } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import { buildFieldViewModel, type FieldViewModel, type FieldDefinition, type ProjectState, type EntityContext } from '@autoart/shared/domain';

import type { DataRecord, RecordDefinition, FieldDef } from '../../types';
import { DataFieldWidget, type DataFieldKind } from '../../ui/molecules/DataFieldWidget';
import { EditableCell } from '../../ui/molecules/EditableCell';
import { StatusColumnSummary } from '../../ui/molecules/StatusColumnSummary';
import { UniversalTableCore, makeFlatRowModel, type TableColumn as CoreTableColumn, type TableRow, type TableFeature } from '../table-core';
import { useCollectionModeOptional } from '../../surfaces/export/CollectionModeProvider';
import { SelectableWrapper } from '../../surfaces/export/SelectableWrapper';

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
    /** Callback to add a new record */
    onAddRecord?: () => void;
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
    /**
     * Row height configuration.
     * - number: Fixed height in pixels
     * - 'auto': Height adjusts to content (enables text wrapping)
     * Default: undefined (uses compact sizing)
     */
    rowHeight?: number | 'auto';
    /**
     * Whether text should wrap in cells.
     * When true, long text wraps instead of truncating.
     * Default: false
     */
    wrapText?: boolean;
    /** Empty state message */
    emptyMessage?: string;
    /** Custom header content (replaces default) */
    renderHeader?: () => React.ReactNode;
    /** Custom footer content */
    renderFooter?: (info: { totalRecords: number; page: number; totalPages: number; selectedIds: Set<string> }) => React.ReactNode;
    /** Additional className */
    className?: string;
}

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

// ==================== HELPERS ====================

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

// ==================== DATA TABLE FLAT ====================

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
    onAddRecord,
    columnOverrides = {},
    visibleColumns: visibleColumnsProp,
    editable = true,
    multiSelect = true,
    pageSize = 50,
    compact = false,
    rowHeight,
    wrapText = false,
    emptyMessage = 'No records found',
    renderHeader,
    renderFooter,
    className,
}: DataTableFlatProps) {
    // Collection mode
    const collectionMode = useCollectionModeOptional();
    const isCollecting = collectionMode?.isCollecting ?? false;

    // Internal state
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
        const fieldColumns = fields
            .filter((field: FieldDef) => field.key !== 'name' && field.key !== 'unique_name')
            .map((field: FieldDef): TableColumn => {
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

    // Paginate records (sorting delegated to core)
    const paginatedRecords = useMemo(() => {
        const start = page * pageSize;
        return records.slice(start, start + pageSize);
    }, [records, page, pageSize]);

    const totalPages = Math.ceil(records.length / pageSize);

    // Handlers
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

    // Convert wrapper columns to core columns with cell() functions
    const coreColumns = useMemo<CoreTableColumn[]>(() => {
        const cols: CoreTableColumn[] = [];

        // Checkbox column for multi-select
        if (multiSelect) {
            const allOnPageSelected = paginatedRecords.length > 0 &&
                paginatedRecords.every((r) => selectedIds.has(r.id));

            cols.push({
                id: '__checkbox__',
                header: '',
                width: 40,
                resizable: false,
                renderHeader: () => (
                    <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300"
                    />
                ),
                cell: (row: TableRow) => {
                    const record = row.data as DataRecord;
                    const isSelected = selectedIds.has(record.id);
                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectOne(record.id)}
                                className="rounded border-slate-300"
                            />
                        </div>
                    );
                },
            });
        }

        // Data columns
        for (const col of displayColumns) {
            cols.push({
                id: col.key,
                header: col.label,
                width: col.width,
                minWidth: col.minWidth,
                resizable: col.resizable,
                align: 'left',
                // sortKey for sortable columns
                sortKey: col.sortable ? (row: TableRow) => {
                    const record = row.data as DataRecord;
                    if (col.key === 'unique_name') return record.unique_name;
                    if (col.key === 'updated_at') return record.updated_at || '';
                    const val = record.data?.[col.key];
                    return val == null ? null : String(val);
                } : undefined,
                // cell renderer with EditableCell
                cell: (row: TableRow) => {
                    const record = row.data as DataRecord;
                    const viewModel = buildCellViewModel(record, col);

                    let cellContent: React.ReactNode;

                    // Custom renderer
                    if (col.renderCell) {
                        cellContent = col.renderCell(record, viewModel);
                    }
                    // Updated at special handling
                    else if (col.key === 'updated_at') {
                        const date = record.updated_at ? new Date(record.updated_at) : null;
                        cellContent = (
                            <div className="text-xs text-slate-500">
                                {date ? date.toLocaleDateString() : '-'}
                            </div>
                        );
                    }
                    // Editable cell (but not during collection mode)
                    else if (col.editable && editable && !isCollecting) {
                        cellContent = (
                            <EditableCell
                                viewModel={viewModel}
                                onSave={(fieldId, value) => handleCellSave(record.id, fieldId, value)}
                                width={col.width}
                                wrapText={wrapText}
                            />
                        );
                    }
                    // Read-only display
                    else {
                        const renderAs = (col.field?.type || 'text') as DataFieldKind;
                        cellContent = <DataFieldWidget kind={renderAs} value={viewModel.value} wrapText={wrapText} />;
                    }

                    // Wrap with SelectableWrapper when in collection mode
                    if (isCollecting) {
                        return (
                            <SelectableWrapper
                                type="field"
                                sourceId={record.id}
                                fieldKey={col.key}
                                displayLabel={`${record.unique_name} → ${col.label}`}
                                value={viewModel.value}
                            >
                                {cellContent}
                            </SelectableWrapper>
                        );
                    }

                    return cellContent;
                },
            });
        }

        return cols;
    }, [displayColumns, multiSelect, selectedIds, buildCellViewModel, editable, isCollecting, wrapText, handleCellSave, handleSelectOne, handleSelectAll, paginatedRecords]);

    // Row model from paginated records
    const rowModel = useMemo(() => {
        return makeFlatRowModel(paginatedRecords);
    }, [paginatedRecords]);

    // Features: column picker in toolbar
    const features = useMemo<TableFeature[]>(() => {
        if (renderHeader) return []; // Custom header replaces default

        return [{
            id: 'column-picker',
            renderToolbarRight: () => (
                <ColumnPicker
                    allColumns={allColumns}
                    visibleKeys={visibleColumnKeys}
                    onToggle={handleToggleColumn}
                />
            ),
        }];
    }, [renderHeader, allColumns, visibleColumnKeys, handleToggleColumn]);

    // Select-all checkbox in header feature
    const selectAllFeature = useMemo<TableFeature | null>(() => {
        if (!multiSelect) return null;
        return {
            id: 'select-all',
            decorateColumns: (cols) => {
                // Find checkbox column and add header checkbox
                return cols.map((col) => {
                    if (col.id === '__checkbox__') {
                        return {
                            ...col,
                            // Header will show select-all checkbox via custom render
                        };
                    }
                    return col;
                });
            },
        };
    }, [multiSelect]);

    const allFeatures = useMemo(() => {
        return [...features, selectAllFeature].filter(Boolean) as TableFeature[];
    }, [features, selectAllFeature]);

    // Get row class for selection highlighting
    const getRowClassName = useCallback((row: TableRow) => {
        const record = row.data as DataRecord;
        const isActive = selectedRecordId === record.id;
        const isSelected = selectedIds.has(record.id);
        if (isActive) return 'bg-blue-50';
        if (isSelected) return 'bg-blue-25';
        return '';
    }, [selectedRecordId, selectedIds]);

    // Status summary footer
    const statusSummaryFooter = useCallback(() => {
        const statusColumns = displayColumns.filter((col) => col.field?.type === 'status');
        if (statusColumns.length === 0) return null;

        return (
            <div className="flex items-center h-10 border-t border-slate-200">
                {/* Checkbox placeholder */}
                {multiSelect && <div className="w-10 px-3" />}

                {/* Columns with status summary */}
                {displayColumns.map((col) => {
                    if (col.field?.type === 'status') {
                        const statusCounts: Record<string, number> = {};
                        for (const record of records) {
                            const statusValue = String(record.data?.[col.key] || '');
                            if (statusValue) {
                                statusCounts[statusValue] = (statusCounts[statusValue] || 0) + 1;
                            }
                        }

                        const countsArray = Object.entries(statusCounts).map(([status, count]) => ({
                            status,
                            count,
                        }));

                        let colorConfig: Record<string, { bgClass: string }> | undefined;
                        const fieldWithConfig = col.field as (typeof col.field) & { statusConfig?: Record<string, { colorClass: string }> };
                        if (fieldWithConfig?.statusConfig) {
                            colorConfig = Object.fromEntries(
                                Object.entries(fieldWithConfig.statusConfig).map(([status, config]) => [
                                    status,
                                    { bgClass: config.colorClass || 'bg-slate-400' },
                                ])
                            );
                        }

                        return (
                            <div key={col.key} className="px-3" style={{ width: col.width }}>
                                <StatusColumnSummary counts={countsArray} colorConfig={colorConfig} />
                            </div>
                        );
                    }

                    return <div key={col.key} className="px-3" style={{ width: col.width }} />;
                })}
            </div>
        );
    }, [displayColumns, records, multiSelect]);

    // Combined footer with status summary and pagination
    const combinedFooter = useCallback(() => {
        const statusFooter = statusSummaryFooter();
        const hasStatusFooter = !!statusFooter;
        const hasPagination = totalPages > 1;
        const hasCustomFooter = !!renderFooter;

        if (!hasStatusFooter && !hasPagination && !hasCustomFooter) return null;

        return (
            <>
                {statusFooter}
                {hasCustomFooter ? (
                    renderFooter({
                        totalRecords: records.length,
                        page,
                        totalPages,
                        selectedIds,
                    })
                ) : hasPagination && (
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200">
                        <span className="text-xs text-slate-500">
                            {records.length} record{records.length !== 1 ? 's' : ''}
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
            </>
        );
    }, [statusSummaryFooter, totalPages, renderFooter, records.length, page, selectedIds]);

    // Loading state
    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center h-64 text-slate-400', className)}>
                <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full" />
            </div>
        );
    }

    // Empty state - no definition
    if (!definition) {
        return (
            <div className={clsx('flex flex-col items-center justify-center h-64 text-slate-400', className)}>
                <p className="text-lg font-medium">No definition</p>
                <p className="text-sm">Select a record type to view</p>
            </div>
        );
    }

    // Empty state - no records
    if (records.length === 0) {
        return (
            <div className={clsx('flex flex-col items-center justify-center h-64 text-slate-400', className)}>
                <p className="text-lg font-medium">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className={clsx('flex flex-col h-full', className)}>
            {/* Custom header */}
            {renderHeader && renderHeader()}

            {/* Core table */}
            <UniversalTableCore
                rowModel={rowModel}
                columns={coreColumns}
                features={allFeatures}
                onRowClick={handleRowClick}
                getRowClassName={getRowClassName}
                stickyHeader
                stickyFooter
                compact={compact}
                rowHeight={rowHeight}
                wrapText={wrapText}
                renderFooter={combinedFooter}
            />

            {/* Add Record button */}
            {onAddRecord && (
                <button
                    onClick={onAddRecord}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border-t border-slate-200"
                >
                    <Plus size={14} />
                    <span>Add {definition?.name || 'Record'}</span>
                </button>
            )}
        </div>
    );
}
