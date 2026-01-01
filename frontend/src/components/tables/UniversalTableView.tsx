import { useState, useMemo, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { Search, Plus, Trash2, Columns, ChevronDown } from 'lucide-react';
import {
    useRecords,
    useRecordDefinitions,
    useRecordDefinition,
    useUpdateRecord,
    useBulkDeleteRecords,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import { DataTable, type TableColumn } from '../tables/DataTable';
import { DataFieldWidget, type DataFieldKind } from '../common/DataFieldWidget';
import type { DataRecord, RecordDefinition, FieldDef } from '../../types';

// ==================== TYPES ====================

export interface UniversalTableViewProps {
    /** Controlled definition ID (for external control via sidebar) */
    definitionId?: string | null;
    /** Initial definition ID to display (uncontrolled mode) */
    initialDefinitionId?: string | null;
    /** Callback when definition changes (for controlled mode) */
    onDefinitionChange?: (id: string | null) => void;
    /** Whether to show the definition selector dropdown */
    showDefinitionSelector?: boolean;
    /** Filter to only show certain definitions (by name or id) */
    definitionFilter?: (def: RecordDefinition) => boolean;
    /** Classification node ID to filter records */
    classificationNodeId?: string | null;
    /** Custom className */
    className?: string;
    /** Whether to allow adding new records */
    allowCreate?: boolean;
    /** Whether to allow bulk delete */
    allowBulkDelete?: boolean;
    /** Whether to allow inline editing */
    allowEdit?: boolean;
    /** Compact mode for embedding */
    compact?: boolean;
}

// ==================== DEFINITION SELECTOR ====================

interface DefinitionSelectorProps {
    definitions: RecordDefinition[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}

function DefinitionSelector({ definitions, selectedId, onSelect }: DefinitionSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selected = definitions.find((d) => d.id === selectedId);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 text-sm font-medium text-slate-700"
            >
                {selected?.styling?.icon && <span>{selected.styling.icon}</span>}
                <span>{selected?.name || 'All Records'}</span>
                <ChevronDown size={14} className={clsx('text-slate-400 transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                        <button
                            onClick={() => {
                                onSelect(null);
                                setIsOpen(false);
                            }}
                            className={clsx(
                                'w-full text-left px-3 py-2 text-sm hover:bg-slate-50',
                                !selectedId && 'bg-blue-50 text-blue-700'
                            )}
                        >
                            All Records
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        {definitions.map((def) => (
                            <button
                                key={def.id}
                                onClick={() => {
                                    onSelect(def.id);
                                    setIsOpen(false);
                                }}
                                className={clsx(
                                    'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2',
                                    selectedId === def.id && 'bg-blue-50 text-blue-700'
                                )}
                            >
                                {def.styling?.icon && <span>{def.styling.icon}</span>}
                                <span>{def.name}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ==================== COLUMN VISIBILITY PICKER ====================

interface ColumnPickerProps {
    allColumns: TableColumn<DataRecord>[];
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
 * UniversalTableView - A powerful, spreadsheet-like view for any record type
 *
 * This is the "Unified Visualization" component from the architecture plan.
 * It can display Tasks, Clients, Invoices, or any other record type with
 * identical sorting, filtering, and bulk editing capabilities.
 *
 * Features:
 * - Definition selector to switch between record types
 * - Dynamic columns from definition.schema_config.fields
 * - Inline editing with automatic API save
 * - Column visibility picker
 * - Search/filter
 * - Bulk selection and delete
 * - Pagination
 */
export function UniversalTableView({
    definitionId: controlledDefinitionId,
    initialDefinitionId = null,
    onDefinitionChange,
    showDefinitionSelector = true,
    definitionFilter,
    classificationNodeId,
    className,
    allowCreate = true,
    allowBulkDelete = true,
    allowEdit = true,
    compact = false,
}: UniversalTableViewProps) {
    // Support controlled and uncontrolled modes
    const [internalDefinitionId, setInternalDefinitionId] = useState<string | null>(initialDefinitionId);

    // Use controlled value if provided, otherwise use internal state
    const selectedDefinitionId = controlledDefinitionId !== undefined ? controlledDefinitionId : internalDefinitionId;

    const handleDefinitionChange = useCallback((id: string | null) => {
        if (onDefinitionChange) {
            onDefinitionChange(id);
        }
        setInternalDefinitionId(id);
    }, [onDefinitionChange]);

    // Sync internal state when controlled value changes
    useEffect(() => {
        if (controlledDefinitionId !== undefined) {
            setInternalDefinitionId(controlledDefinitionId);
        }
    }, [controlledDefinitionId]);

    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [visibleColumnKeys, setVisibleColumnKeys] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(0);
    const pageSize = 50;

    // Hooks
    const { inspectRecord, openDrawer } = useUIStore();
    const { data: allDefinitions = [] } = useRecordDefinitions();
    const { data: definition } = useRecordDefinition(selectedDefinitionId);
    const { data: records = [], isLoading } = useRecords({
        definitionId: selectedDefinitionId || undefined,
        classificationNodeId: classificationNodeId || undefined,
        search: searchQuery || undefined,
    });
    const updateRecord = useUpdateRecord();
    const bulkDelete = useBulkDeleteRecords();

    // Filter definitions
    const filteredDefinitions = useMemo(() => {
        if (!definitionFilter) return allDefinitions;
        return allDefinitions.filter(definitionFilter);
    }, [allDefinitions, definitionFilter]);

    // Build columns from definition schema
    const allColumns = useMemo<TableColumn<DataRecord>[]>(() => {
        // Name column (always present)
        const nameColumn: TableColumn<DataRecord> = {
            key: 'unique_name',
            label: 'Name',
            width: 200,
            minWidth: 100,
            sortable: true,
            editable: allowEdit,
            resizable: true,
            field: { key: 'unique_name', type: 'text', label: 'Name' },
            renderCell: (record) => (
                <div className="text-sm font-medium text-slate-800 truncate" title={record.unique_name}>
                    {record.unique_name}
                </div>
            ),
        };

        // Dynamic columns from schema
        const fields = definition?.schema_config?.fields || [];
        const fieldColumns = fields.map((field: FieldDef): TableColumn<DataRecord> => {
            const renderAs = ((field as FieldDef & { renderAs?: string }).renderAs || field.type || 'text') as DataFieldKind;

            // Determine sensible default width based on field type
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
                field: field as FieldDef & { renderAs?: string },
                sortable: ['text', 'number', 'date', 'status', 'select'].includes(field.type),
                editable: allowEdit,
                resizable: true,
                renderCell: (record) => {
                    const value = record.data?.[field.key];
                    return <DataFieldWidget kind={renderAs} value={value} />;
                },
            };
        });

        // Updated at column
        const updatedColumn: TableColumn<DataRecord> = {
            key: 'updated_at',
            label: 'Updated',
            width: 100,
            minWidth: 80,
            sortable: true,
            editable: false,
            resizable: true,
            renderCell: (record) => {
                const date = record.updated_at ? new Date(record.updated_at) : null;
                return (
                    <div className="text-xs text-slate-500">
                        {date ? date.toLocaleDateString() : '-'}
                    </div>
                );
            },
        };

        return [nameColumn, ...fieldColumns, updatedColumn];
    }, [definition, allowEdit]);

    // Initialize visible columns when definition changes
    useMemo(() => {
        if (visibleColumnKeys.size === 0 || selectedDefinitionId) {
            // Show first 6 columns by default
            const defaultVisible = allColumns.slice(0, 6).map((c) => c.key);
            setVisibleColumnKeys(new Set(defaultVisible));
        }
    }, [selectedDefinitionId, allColumns.length]);

    // Filter visible columns
    const visibleColumns = useMemo(() => {
        if (visibleColumnKeys.size === 0) return allColumns.slice(0, 6);
        return allColumns.filter((col) => visibleColumnKeys.has(col.key));
    }, [allColumns, visibleColumnKeys]);

    // Paginate records
    const paginatedRecords = useMemo(() => {
        const start = page * pageSize;
        return records.slice(start, start + pageSize);
    }, [records, page, pageSize]);

    const totalPages = Math.ceil(records.length / pageSize);

    // Handlers
    const handleCellChange = useCallback(
        (recordId: string, key: string, value: unknown) => {
            const record = records.find((r) => r.id === recordId);
            if (!record) return;

            if (key === 'unique_name') {
                updateRecord.mutate({ id: recordId, uniqueName: String(value) });
            } else {
                const updatedData = { ...record.data, [key]: value };
                updateRecord.mutate({ id: recordId, data: updatedData });
            }
        },
        [records, updateRecord]
    );

    const handleToggleColumn = useCallback((key: string) => {
        setVisibleColumnKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const handleSelectRecord = useCallback((recordId: string) => {
        inspectRecord(recordId);
    }, [inspectRecord]);

    const handleCreateRecord = useCallback(() => {
        if (selectedDefinitionId) {
            openDrawer('create-record', {
                definitionId: selectedDefinitionId,
                classificationNodeId,
            });
        }
    }, [selectedDefinitionId, classificationNodeId, openDrawer]);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Delete ${selectedIds.size} record(s)?`)) return;

        bulkDelete.mutate(Array.from(selectedIds));
        setSelectedIds(new Set());
    }, [selectedIds, bulkDelete]);

    // Render footer with pagination and bulk actions
    const renderFooter = useCallback(() => {
        return (
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">
                        {records.length} record{records.length !== 1 ? 's' : ''}
                    </span>

                    {selectedIds.size > 0 && allowBulkDelete && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                            <Trash2 size={12} />
                            Delete {selectedIds.size}
                        </button>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <span className="text-xs text-slate-500">
                            Page {page + 1} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        );
    }, [records.length, selectedIds.size, allowBulkDelete, handleBulkDelete, page, totalPages]);

    return (
        <div className={clsx('flex flex-col h-full bg-slate-50', className)}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                    {showDefinitionSelector && (
                        <DefinitionSelector
                            definitions={filteredDefinitions}
                            selectedId={selectedDefinitionId}
                            onSelect={(id) => {
                                handleDefinitionChange(id);
                                setPage(0);
                                setSelectedIds(new Set());
                            }}
                        />
                    )}

                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search records..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(0);
                            }}
                            className="pl-8 pr-3 py-1.5 w-64 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <ColumnPicker
                        allColumns={allColumns}
                        visibleKeys={visibleColumnKeys}
                        onToggle={handleToggleColumn}
                    />

                    {allowCreate && selectedDefinitionId && (
                        <button
                            onClick={handleCreateRecord}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                        >
                            <Plus size={14} />
                            Add Record
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64 text-slate-400">
                        Loading records...
                    </div>
                ) : !selectedDefinitionId ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <p className="text-lg font-medium">Select a record type</p>
                        <p className="text-sm">Choose a definition from the dropdown to view records</p>
                    </div>
                ) : (
                    <DataTable<DataRecord>
                        data={paginatedRecords}
                        columns={visibleColumns}
                        getRowKey={(record) => record.id}
                        selectedRowId={useUIStore.getState().selection?.type === 'record' ? useUIStore.getState().selection?.id : null}
                        onRowSelect={handleSelectRecord}
                        onCellChange={handleCellChange}
                        title={definition?.name}
                        icon={definition?.styling?.icon}
                        emptyMessage="No records found"
                        compact={compact}
                        stickyHeader
                        stickyFooter
                        renderFooter={renderFooter}
                    />
                )}
            </div>
        </div>
    );
}
