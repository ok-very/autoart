/**
 * RecordView - Reusable composite for displaying records in a list/table
 *
 * This is a REUSABLE COMPOSITE that uses DataTableFlat.
 * It handles:
 * - Definition selector with badge counts
 * - Search with keyboard shortcuts
 * - Bulk actions (delete, classify)
 * - Create button with definition context
 * - Drawer interactions
 *
 * The actual table rendering is delegated to DataTableFlat.
 * 
 * For page-level usage in RecordsPage.
 */

import { clsx } from 'clsx';
import { Search, Plus, Trash2, FolderOpen, Upload, ChevronDown, Database, Sparkles } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import { Badge, Card } from '@autoart/ui';

import { DataTableFlat } from './DataTableFlat';
import {
    useRecords,
    useRecordDefinitions,
    useRecordDefinition,
    useUpdateRecord,
    useBulkDeleteRecords,
    useRecordStats,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import type { RecordDefinition } from '../../types';

// ==================== DEFINITION SELECTOR ====================

interface DefinitionSelectorProps {
    definitions: RecordDefinition[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    stats?: Map<string, number>;
}

function DefinitionSelector({ definitions, selectedId, onSelect, stats }: DefinitionSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selected = definitions.find((d) => d.id === selectedId);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm',
                    isOpen && 'border-blue-400 ring-2 ring-blue-100'
                )}
            >
                {selected?.styling?.icon ? (
                    <span className="text-base">{selected.styling.icon}</span>
                ) : (
                    <Database size={16} className="text-slate-400" />
                )}
                <span className="text-slate-700">{selected?.name || 'All Records'}</span>
                {stats && selectedId && stats.get(selectedId) !== undefined && (
                    <Badge size="sm" variant="neutral">{stats.get(selectedId)}</Badge>
                )}
                <ChevronDown
                    size={16}
                    className={clsx('text-slate-400 transition-transform', isOpen && 'rotate-180')}
                />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <Card className="absolute top-full left-0 mt-2 w-64 z-20 py-1 max-h-80 overflow-y-auto shadow-xl border border-slate-200">
                        {/* All Records option */}
                        <button
                            onClick={() => {
                                onSelect(null);
                                setIsOpen(false);
                            }}
                            className={clsx(
                                'w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-slate-50 transition-colors',
                                !selectedId && 'bg-blue-50 text-blue-700'
                            )}
                        >
                            <Database size={16} className={clsx(!selectedId ? 'text-blue-600' : 'text-slate-400')} />
                            <span className="flex-1">All Records</span>
                            {stats && (
                                <Badge size="sm" variant="neutral">
                                    {Array.from(stats.values()).reduce((a, b) => a + b, 0)}
                                </Badge>
                            )}
                        </button>

                        <div className="border-t border-slate-100 my-1" />

                        {/* Definition list */}
                        {definitions.length === 0 ? (
                            <div className="px-3 py-4 text-center text-slate-400 text-sm">
                                <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
                                <p>No record types defined</p>
                            </div>
                        ) : (
                            definitions.map((def) => (
                                <button
                                    key={def.id}
                                    onClick={() => {
                                        onSelect(def.id);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        'w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-slate-50 transition-colors',
                                        selectedId === def.id && 'bg-blue-50 text-blue-700'
                                    )}
                                >
                                    {def.styling?.icon ? (
                                        <span className="text-base">{def.styling.icon}</span>
                                    ) : (
                                        <Database size={16} className="text-slate-400" />
                                    )}
                                    <span className="flex-1 truncate">{def.name}</span>
                                    {stats && stats.get(def.id) !== undefined && (
                                        <Badge size="sm" variant={selectedId === def.id ? 'info' : 'neutral'}>
                                            {stats.get(def.id)}
                                        </Badge>
                                    )}
                                </button>
                            ))
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}

// ==================== RECORD VIEW ======================================

interface RecordViewProps {
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

export function RecordView({
    definitionId: controlledDefinitionId,
    onDefinitionChange,
    definitionFilter,
    classificationNodeId,
    className,
}: RecordViewProps) {
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
    const { data: recordStats = [] } = useRecordStats();
    const updateRecord = useUpdateRecord();
    const bulkDelete = useBulkDeleteRecords();

    // Stats map
    const statsMap = useMemo(() => {
        const map = new Map<string, number>();
        recordStats.forEach((s) => map.set(s.definitionId, s.count));
        return map;
    }, [recordStats]);

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
        <main className={clsx('flex-1 flex flex-col overflow-hidden bg-slate-50 relative', className)}>
            {/* Toolbar - Sticky at top */}
            <div className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    {/* Definition Selector */}
                    <DefinitionSelector
                        definitions={filteredDefinitions}
                        selectedId={definitionId}
                        onSelect={handleDefinitionChange}
                        stats={statsMap}
                    />

                    {/* Divider */}
                    <div className="h-6 w-px bg-slate-200" />

                    {/* Search */}
                    <div className="relative group">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search records..."
                            className="w-64 pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            data-aa-component="RecordList"
                            data-aa-id="search-records"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Record count badge */}
                    <div className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-500">
                        {records.length} {records.length === 1 ? 'record' : 'records'}
                    </div>

                    {/* Actions Group */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenIngestion}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
                            title="Import records"
                        >
                            <Upload size={15} />
                            <span>Import</span>
                        </button>

                        {definitionId && (
                            <button
                                onClick={handleCreateRecord}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all active:translate-y-px"
                            >
                                <Plus size={16} />
                                <span>New {definition?.name || 'Record'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-hidden relative">
                {definitionId ? (
                    <div className="absolute inset-0 bg-white">
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
                    </div>
                ) : (
                    /* Elegant Empty State */
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                            <FolderOpen size={32} className="text-blue-500/50" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-1">Select a Record Type</h3>
                        <p className="text-sm text-slate-500 max-w-xs text-center">
                            Choose a definition from the dropdown above to view and manage its records.
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}
