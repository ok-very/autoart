/**
 * RecordList - Reusable composite for displaying records in a list/table
 *
 * This is a REUSABLE COMPOSITE that uses DataTableFlat.
 * It handles:
 * - Definition selector
 * - Search
 * - Bulk actions (delete, classify)
 * - Create button
 * - Drawer interactions
 *
 * The actual table rendering is delegated to DataTableFlat.
 * 
 * For page-level usage, see RecordPage which wraps this with layout.
 */

import { useState, useMemo, useCallback } from 'react';
import { Search, Plus, Trash2, FolderOpen, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import {
    useRecords,
    useRecordDefinitions,
    useRecordDefinition,
    useUpdateRecord,
    useBulkDeleteRecords,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import { DataTableFlat } from './DataTableFlat';
import type { RecordDefinition } from '../../types';

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
                <svg className={clsx('w-4 h-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
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

// ==================== RECORD LIST ====================

interface RecordListProps {
    /** Controlled definition ID */
    definitionId?: string | null;
    /** Callback when definition changes */
    onDefinitionChange?: (id: string | null) => void;
    /** Filter to only show certain definitions */
    definitionFilter?: (def: RecordDefinition) => boolean;
    /** Classification node ID to filter records */
    classificationNodeId?: string | null;
    /** Additional className */
    className?: string;
}

export function RecordList({
    definitionId: controlledDefinitionId,
    onDefinitionChange,
    definitionFilter,
    classificationNodeId,
    className,
}: RecordListProps) {
    // State
    const [internalDefinitionId, setInternalDefinitionId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Determine definition ID (controlled or internal)
    const definitionId = controlledDefinitionId !== undefined ? controlledDefinitionId : internalDefinitionId;

    // Hooks
    const { inspectRecord, openDrawer } = useUIStore();
    const { data: allDefinitions = [] } = useRecordDefinitions();
    const { data: definition } = useRecordDefinition(definitionId);
    const { data: records = [], isLoading } = useRecords({
        definitionId: definitionId || undefined,
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

    // Handlers
    const handleDefinitionChange = useCallback((id: string | null) => {
        if (onDefinitionChange) {
            onDefinitionChange(id);
        }
        setInternalDefinitionId(id);
        setSelectedIds(new Set());
    }, [onDefinitionChange]);

    const handleRowSelect = useCallback((recordId: string) => {
        inspectRecord(recordId);
    }, [inspectRecord]);

    const handleCellChange = useCallback((recordId: string, fieldKey: string, value: unknown) => {
        const record = records.find((r) => r.id === recordId);
        if (!record) return;

        if (fieldKey === 'unique_name') {
            updateRecord.mutate({ id: recordId, uniqueName: String(value) });
        } else {
            const updatedData = { ...record.data, [fieldKey]: value };
            updateRecord.mutate({ id: recordId, data: updatedData });
        }
    }, [records, updateRecord]);

    const handleSelectionChange = useCallback((ids: Set<string>) => {
        setSelectedIds(ids);
    }, []);

    const handleCreateRecord = useCallback(() => {
        if (definitionId) {
            openDrawer('create-record', {
                definitionId,
                classificationNodeId,
            });
        }
    }, [definitionId, classificationNodeId, openDrawer]);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.size === 0) return;

        openDrawer('confirm-delete', {
            title: 'Delete Records',
            message: `Are you sure you want to delete ${selectedIds.size} record${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`,
            onConfirm: async () => {
                await bulkDelete.mutateAsync([...selectedIds]);
                setSelectedIds(new Set());
            },
        });
    }, [selectedIds, bulkDelete, openDrawer]);

    const handleBulkClassify = useCallback(() => {
        if (selectedIds.size === 0) return;
        openDrawer('classify-records', {
            recordIds: [...selectedIds],
            onSuccess: () => setSelectedIds(new Set()),
        });
    }, [selectedIds, openDrawer]);

    const handleOpenIngestion = useCallback(() => {
        openDrawer('ingestion', {});
    }, [openDrawer]);

    // Render footer with bulk actions
    const renderFooter = useCallback(({ totalRecords, page, totalPages, selectedIds: footerSelectedIds }: {
        totalRecords: number;
        page: number;
        totalPages: number;
        selectedIds: Set<string>;
    }) => {
        const hasSelection = footerSelectedIds.size > 0;

        return (
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">
                        {totalRecords} record{totalRecords !== 1 ? 's' : ''}
                    </span>

                    {hasSelection && (
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                            <span className="text-sm text-slate-500">
                                {footerSelectedIds.size} selected
                            </span>
                            <button
                                onClick={handleBulkClassify}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                data-aa-component="RecordList"
                                data-aa-id="bulk-classify"
                                data-aa-action="classify"
                            >
                                <FolderOpen size={12} />
                                Classify
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={bulkDelete.isPending}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                                data-aa-component="RecordList"
                                data-aa-id="bulk-delete"
                                data-aa-action="delete"
                            >
                                <Trash2 size={12} />
                                Delete
                            </button>
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <span className="text-xs text-slate-500">
                        Page {page + 1} of {totalPages}
                    </span>
                )}
            </div>
        );
    }, [handleBulkClassify, handleBulkDelete, bulkDelete.isPending]);

    // Get current selection from store for highlighting
    const currentSelection = useUIStore((state) =>
        state.selection?.type === 'record' ? state.selection.id : null
    );

    return (
        <main className={clsx('flex-1 flex flex-col overflow-hidden bg-white', className)}>
            {/* Toolbar */}
            <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50">
                <div className="flex items-center gap-3">
                    {/* Definition Selector */}
                    <DefinitionSelector
                        definitions={filteredDefinitions}
                        selectedId={definitionId}
                        onSelect={handleDefinitionChange}
                    />

                    {/* Search */}
                    <div className="relative">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search records..."
                            className="w-64 pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            data-aa-component="RecordList"
                            data-aa-id="search-records"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Record count */}
                    <span className="text-sm text-slate-400">
                        {records.length} record{records.length !== 1 ? 's' : ''}
                    </span>

                    {/* Import button */}
                    <button
                        onClick={handleOpenIngestion}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        data-aa-component="RecordList"
                        data-aa-id="open-ingestion"
                        data-aa-action="open-drawer"
                    >
                        <Upload size={16} />
                        Import
                    </button>

                    {/* Create button */}
                    {definitionId && (
                        <button
                            onClick={handleCreateRecord}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            data-aa-component="RecordList"
                            data-aa-id="create-record"
                            data-aa-action="create"
                        >
                            <Plus size={16} />
                            New {definition?.name || 'Record'}
                        </button>
                    )}
                </div>
            </div>

            {/* Table - Delegated to DataTableFlat */}
            <div className="flex-1 overflow-hidden">
                {definitionId ? (
                    <DataTableFlat
                        records={records}
                        definition={definition ?? null}
                        isLoading={isLoading}
                        selectedRecordId={currentSelection}
                        onRowSelect={handleRowSelect}
                        onCellChange={handleCellChange}
                        onSelectionChange={handleSelectionChange}
                        editable={true}
                        multiSelect={true}
                        renderFooter={renderFooter}
                        emptyMessage={searchQuery ? 'No records match your search' : 'No records yet. Create your first record!'}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <FolderOpen size={48} className="mb-3 opacity-50" />
                        <p className="text-lg font-medium">Select a record type</p>
                        <p className="text-sm mt-1">Choose a definition from the dropdown to view records</p>
                    </div>
                )}
            </div>
        </main>
    );
}
