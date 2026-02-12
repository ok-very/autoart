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
 * - Column visibility (persisted via Zustand store)
 * - Sorting via TanStack Table (state layer) + UniversalTableCore (renderer)
 * - Global text filter via FilterBar
 * - Row selection with multi-select
 * - Pagination (internal state)
 * - Builds FieldViewModels for cells
 *
 * Architecture:
 * - TanStack Table manages state (sorting, filtering, column visibility)
 * - UniversalTableCore renders pre-sorted, pre-filtered rows
 * - Wrapper handles pagination, selection, cell rendering
 * - Wrapper provides cell() functions with domain factory calls
 */

import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';

import { buildFieldViewModel, type FieldViewModel, type FieldDefinition, type ProjectState, type EntityContext } from '@autoart/shared/domain';
import { ColumnPicker, FilterBar, type ColumnPickerField } from '@autoart/ui';

import type { DataRecord, RecordDefinition, FieldDef } from '../../types';
import { stringifyFieldValue } from '../../utils/stringifyFieldValue';
import { fuzzyFilter, exactFilter, includesFilter, dateRangeFilter } from '../../utils/filterFunctions';
import { useTableState } from '../../hooks/useTableState';
import { useTableFilterStore } from '../../stores/tableFilterStore';
import { DataFieldWidget, type DataFieldKind } from '../../ui/molecules/DataFieldWidget';
import { EditableCell } from '../../ui/molecules/EditableCell';
import { StatusColumnSummary } from '../../ui/molecules/StatusColumnSummary';
import { UniversalTableCore, type TableColumn as CoreTableColumn, type TableRow, type TableFeature, type SortState } from '../table-core';
import { useCollectionModeOptional } from '../../workflows/export/context/CollectionModeProvider';
import { SelectableWrapper } from '../../workflows/export/components/SelectableWrapper';

// ==================== TYPES ====================

export interface TableColumn {
    key: string;
    label: string;
    field?: FieldDef;
    width?: number;
    minWidth?: number;
    sortable?: boolean;
    editable?: boolean;
    resizable?: boolean;
    renderCell?: (record: DataRecord, viewModel: FieldViewModel) => React.ReactNode;
}

export interface DataTableFlatProps {
    records: DataRecord[];
    definition: RecordDefinition | null;
    isLoading?: boolean;
    selectedRecordId?: string | null;
    onRowSelect?: (recordId: string) => void;
    onCellChange?: (recordId: string, fieldKey: string, value: unknown) => void;
    onSelectionChange?: (selectedIds: Set<string>) => void;
    onAddRecord?: () => void;
    columnOverrides?: Partial<Record<string, Partial<TableColumn>>>;
    visibleColumns?: string[];
    editable?: boolean;
    multiSelect?: boolean;
    pageSize?: number;
    compact?: boolean;
    rowHeight?: number | 'auto';
    wrapText?: boolean;
    emptyMessage?: string;
    renderHeader?: () => React.ReactNode;
    renderFooter?: (info: { totalRecords: number; page: number; totalPages: number; selectedIds: Set<string> }) => React.ReactNode;
    className?: string;
}

// ==================== HELPERS ====================

function getFilterFnForFieldType(type?: string) {
    switch (type) {
        case 'status':
        case 'select':
            return exactFilter;
        case 'date':
            return dateRangeFilter;
        case 'tags':
            return includesFilter;
        default:
            return fuzzyFilter;
    }
}

function deriveInitialVisibility(
    visibleColumnsProp: string[] | undefined,
    allColumns: TableColumn[],
    storedVisibility: VisibilityState,
): VisibilityState {
    if (visibleColumnsProp) {
        const vis: VisibilityState = {};
        allColumns.forEach((col) => {
            vis[col.key] = visibleColumnsProp.includes(col.key);
        });
        return vis;
    }
    if (Object.keys(storedVisibility).length > 0) {
        return storedVisibility;
    }
    const vis: VisibilityState = {};
    allColumns.forEach((col, i) => {
        vis[col.key] = i < 6;
    });
    return vis;
}

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
    const collectionMode = useCollectionModeOptional();
    const isCollecting = collectionMode?.isCollecting ?? false;

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(0);

    // Build columns from definition schema
    const allColumns = useMemo<TableColumn[]>(() => {
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

    // ==================== TANSTACK TABLE SETUP ====================

    const definitionId = definition?.id ?? '';
    const storedVisibility = useTableFilterStore((s) => s.getColumnVisibility(definitionId));
    const storedSorting = useTableFilterStore((s) => s.getSorting(definitionId));
    const setStoredVisibility = useTableFilterStore((s) => s.setColumnVisibility);
    const setStoredSorting = useTableFilterStore((s) => s.setSorting);

    const tanstackColumns = useMemo<ColumnDef<DataRecord, any>[]>(() => {
        return allColumns.map((col): ColumnDef<DataRecord, any> => ({
            id: col.key,
            accessorFn: (record) => {
                if (col.key === 'unique_name') return record.unique_name;
                if (col.key === 'updated_at') return record.updated_at ?? '';
                return record.data?.[col.key];
            },
            header: col.label,
            filterFn: getFilterFnForFieldType(col.field?.type),
            enableSorting: col.sortable ?? false,
            enableHiding: true,
        }));
    }, [allColumns]);

    const table = useTableState({
        data: records,
        columns: tanstackColumns,
        initialSorting: storedSorting,
        initialColumnVisibility: deriveInitialVisibility(visibleColumnsProp, allColumns, storedVisibility),
        initialGlobalFilter: '',
    });

    // Sync visibleColumnsProp → TanStack state when prop changes
    useEffect(() => {
        if (visibleColumnsProp) {
            const visibility: VisibilityState = {};
            allColumns.forEach((col) => {
                visibility[col.key] = visibleColumnsProp.includes(col.key);
            });
            table.setColumnVisibility(visibility);
        }
    }, [visibleColumnsProp, allColumns, table]);

    // Sync column visibility to store (only when not prop-controlled)
    const visibility = table.getState().columnVisibility;
    useEffect(() => {
        if (definitionId && !visibleColumnsProp) {
            setStoredVisibility(definitionId, visibility);
        }
    }, [visibility, definitionId, visibleColumnsProp, setStoredVisibility]);

    // Sync sorting to store
    const sorting = table.getState().sorting;
    useEffect(() => {
        if (definitionId) {
            setStoredSorting(definitionId, sorting);
        }
    }, [sorting, definitionId, setStoredSorting]);

    // ==================== DERIVED FROM TANSTACK ====================

    const globalFilter = table.getState().globalFilter;
    const columnFilters = table.getState().columnFilters;
    const filterSortKey = `${globalFilter}-${JSON.stringify(columnFilters)}-${JSON.stringify(sorting)}`;

    const [pageResetKey, setPageResetKey] = useState(filterSortKey);
    if (filterSortKey !== pageResetKey) {
        setPageResetKey(filterSortKey);
        setPage(0);
    }

    const filteredSortedRows = table.getFilteredRowModel().rows;
    const totalFilteredCount = filteredSortedRows.length;

    const paginatedRows = useMemo(() => {
        const start = page * pageSize;
        return filteredSortedRows.slice(start, start + pageSize);
    }, [filteredSortedRows, page, pageSize]);

    const totalPages = Math.ceil(totalFilteredCount / pageSize);

    const displayColumns = useMemo(() => {
        return allColumns.filter((col) => {
            const tsCol = table.getColumn(col.key);
            return tsCol ? tsCol.getIsVisible() : true;
        });
    }, [allColumns, visibility, table]);

    const coreSortState: SortState = useMemo(() => {
        if (sorting.length === 0) return null;
        return { columnId: sorting[0].id, direction: sorting[0].desc ? 'desc' : 'asc' };
    }, [sorting]);

    const handleSortChange = useCallback((columnId: string) => {
        const current = table.getState().sorting;
        if (current.length > 0 && current[0].id === columnId) {
            if (!current[0].desc) {
                table.setSorting([{ id: columnId, desc: true }]);
            } else {
                table.setSorting([]);
            }
        } else {
            table.setSorting([{ id: columnId, desc: false }]);
        }
    }, [table]);

    // ==================== HANDLERS ====================

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

    const paginatedRecords = useMemo(() => {
        return paginatedRows.map((row) => row.original);
    }, [paginatedRows]);

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

        return {
            ...viewModel,
            editable: (column.editable ?? editable) && viewModel.editable,
        };
    }, [editable]);

    // Convert wrapper columns to core columns with cell() functions
    const coreColumns = useMemo<CoreTableColumn[]>(() => {
        const cols: CoreTableColumn[] = [];

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

        for (const col of displayColumns) {
            cols.push({
                id: col.key,
                header: col.label,
                width: col.width,
                minWidth: col.minWidth,
                resizable: col.resizable,
                align: 'left',
                sortKey: col.sortable ? (row: TableRow) => {
                    const record = row.data as DataRecord;
                    if (col.key === 'unique_name') return record.unique_name;
                    if (col.key === 'updated_at') return record.updated_at || '';
                    const val = record.data?.[col.key];
                    return stringifyFieldValue(val);
                } : undefined,
                cell: (row: TableRow) => {
                    const record = row.data as DataRecord;
                    const viewModel = buildCellViewModel(record, col);

                    let cellContent: React.ReactNode;

                    if (col.renderCell) {
                        cellContent = col.renderCell(record, viewModel);
                    } else if (col.key === 'updated_at') {
                        const date = record.updated_at ? new Date(record.updated_at) : null;
                        cellContent = (
                            <div className="text-xs text-ws-text-secondary">
                                {date ? date.toLocaleDateString() : '-'}
                            </div>
                        );
                    } else if (col.editable && editable && !isCollecting) {
                        cellContent = (
                            <EditableCell
                                viewModel={viewModel}
                                onSave={(fieldId, value) => handleCellSave(record.id, fieldId, value)}
                                width={col.width}
                                wrapText={wrapText}
                            />
                        );
                    } else {
                        const renderAs = (col.field?.type || 'text') as DataFieldKind;
                        cellContent = <DataFieldWidget kind={renderAs} value={viewModel.value} wrapText={wrapText} />;
                    }

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
        const tableRows: TableRow[] = paginatedRecords.map((record) => ({
            id: record.id,
            data: record,
        }));
        return {
            getRows: () => tableRows,
            capabilities: { selectable: multiSelect },
        };
    }, [paginatedRecords, multiSelect]);

    // ==================== FEATURES ====================

    const columnPickerFields: ColumnPickerField[] = useMemo(() => {
        return allColumns.map((col) => ({
            fieldName: col.key,
            label: col.label,
        }));
    }, [allColumns]);

    const visibleKeys = useMemo(() => {
        return new Set(
            allColumns.filter((col) => table.getColumn(col.key)?.getIsVisible()).map((c) => c.key)
        );
    }, [allColumns, visibility, table]);

    const features = useMemo<TableFeature[]>(() => {
        if (renderHeader) return [];

        return [
            {
                id: 'filter-bar',
                renderToolbarLeft: () => (
                    <FilterBar
                        searchQuery={table.getState().globalFilter ?? ''}
                        onSearchChange={(query) => table.setGlobalFilter(query)}
                        resultCount={totalFilteredCount}
                        placeholder={`Filter ${definition?.name || 'records'}...`}
                    />
                ),
            },
            {
                id: 'column-picker',
                renderToolbarRight: () => (
                    <ColumnPicker
                        allFields={columnPickerFields}
                        visibleKeys={visibleKeys}
                        onToggle={(fieldName) => {
                            const column = table.getColumn(fieldName);
                            column?.toggleVisibility();
                        }}
                    />
                ),
            },
        ];
    }, [renderHeader, table, totalFilteredCount, definition?.name, columnPickerFields, visibleKeys]);

    const selectAllFeature = useMemo<TableFeature | null>(() => {
        if (!multiSelect) return null;
        return {
            id: 'select-all',
            decorateColumns: (cols) => {
                return cols.map((col) => {
                    if (col.id === '__checkbox__') {
                        return { ...col };
                    }
                    return col;
                });
            },
        };
    }, [multiSelect]);

    const allFeatures = useMemo(() => {
        return [...features, selectAllFeature].filter(Boolean) as TableFeature[];
    }, [features, selectAllFeature]);

    // ==================== ROW STYLING ====================

    const getRowClassName = useCallback((row: TableRow) => {
        const record = row.data as DataRecord;
        const isActive = selectedRecordId === record.id;
        const isSelected = selectedIds.has(record.id);
        if (isActive) return 'bg-blue-50';
        if (isSelected) return 'bg-blue-25';
        return '';
    }, [selectedRecordId, selectedIds]);

    // ==================== FOOTER ====================

    const statusSummaryFooter = useCallback(() => {
        const statusColumns = displayColumns.filter((col) => col.field?.type === 'status');
        if (statusColumns.length === 0) return null;

        return (
            <div className="flex items-center h-8 border-t border-ws-panel-border">
                {multiSelect && <div className="w-10 px-3" />}
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
                        totalRecords: totalFilteredCount,
                        page,
                        totalPages,
                        selectedIds,
                    })
                ) : hasPagination && (
                    <div className="flex items-center justify-between px-4 py-2 bg-ws-bg border-t border-ws-panel-border">
                        <span className="text-xs text-ws-text-secondary">
                            {totalFilteredCount} record{totalFilteredCount !== 1 ? 's' : ''}
                            {totalFilteredCount !== records.length && ` of ${records.length}`}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="px-2 py-1 text-xs rounded border border-ws-panel-border hover:bg-slate-100 disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <span className="text-xs text-ws-text-secondary">
                                Page {page + 1} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="px-2 py-1 text-xs rounded border border-ws-panel-border hover:bg-slate-100 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }, [statusSummaryFooter, totalPages, renderFooter, totalFilteredCount, records.length, page, selectedIds]);

    // ==================== RENDER ====================

    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center h-64 text-ws-muted', className)}>
                <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full" />
            </div>
        );
    }

    if (!definition) {
        return (
            <div className={clsx('flex flex-col items-center justify-center h-64 text-ws-muted', className)}>
                <p className="text-ws-body">No definition</p>
                <p className="text-sm">Select a record type to view</p>
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <div className={clsx('flex flex-col items-center justify-center h-64 text-ws-muted', className)}>
                <p className="text-ws-body">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className={clsx('flex flex-col h-full', className)}>
            {renderHeader && renderHeader()}

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
                externalSort
                externalSortState={coreSortState}
                onSortChange={handleSortChange}
            />

            {onAddRecord && (
                <button
                    onClick={onAddRecord}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-ws-text-secondary hover:bg-ws-bg hover:text-ws-text-secondary transition-colors border-t border-ws-panel-border"
                >
                    <Plus size={14} />
                    <span>Add {definition?.name || 'Record'}</span>
                </button>
            )}
        </div>
    );
}
