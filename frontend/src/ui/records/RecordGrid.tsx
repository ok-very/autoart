import { clsx } from 'clsx';
import { Search, Plus, Trash2, FolderOpen, MoreHorizontal, ArrowUpDown, Copy } from 'lucide-react';
import { useState, useMemo } from 'react';

import {
  useRecords,
  useRecordDefinitions,
  useRecordDefinition,
  useBulkDeleteRecords,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import { ImageFieldRenderer } from '../molecules';
import type { DataRecord, FieldDef } from '../../types';

/** Check if a field should be rendered as an image */
function isImageField(type: string, key: string): boolean {
  if (type === 'image' || type === 'file') return true;
  // Common image field patterns
  const imagePatterns = ['thumbnail', 'image', 'photo', 'picture', 'avatar'];
  const lowerKey = key.toLowerCase();
  return imagePatterns.some((p) => lowerKey.includes(p));
}

interface RecordGridProps {
  definitionId: string | null;
}

type SortDirection = 'asc' | 'desc';
type SortConfig = { key: string; direction: SortDirection } | null;

/**
 * Main grid view for displaying records of a selected definition type.
 * Features:
 * - Dynamic columns based on definition schema
 * - Search/filter
 * - Sorting
 * - Multi-select with bulk actions
 * - Pagination
 */
export function RecordGrid({ definitionId }: RecordGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { inspectRecord, openOverlay } = useUIStore();
  const { data: allDefinitions } = useRecordDefinitions();
  const { data: definition } = useRecordDefinition(definitionId);
  const { data: records, isLoading } = useRecords({
    definitionId: definitionId || undefined,
    search: searchQuery || undefined,
  });
  const bulkDelete = useBulkDeleteRecords();

  // Get columns from definition schema
  const columns = useMemo(() => {
    const defaultColumns: { key: string; label: string; type: string }[] = [
      { key: 'unique_name', label: 'Name', type: 'text' },
    ];

    if (definition?.schema_config?.fields) {
      const schemaColumns = definition.schema_config.fields
        .slice(0, 5) // Limit to 5 columns for readability
        .map((field: FieldDef) => ({
          key: field.key,
          label: field.label,
          type: field.type,
        }));
      return [...defaultColumns, ...schemaColumns];
    }

    return defaultColumns;
  }, [definition]);

  // Filter and sort records
  const processedRecords = useMemo(() => {
    if (!records) return [];

    const result = [...records];

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: unknown;
        let bVal: unknown;

        if (sortConfig.key === 'unique_name') {
          aVal = a.unique_name;
          bVal = b.unique_name;
        } else {
          aVal = (a.data as Record<string, unknown>)?.[sortConfig.key];
          bVal = (b.data as Record<string, unknown>)?.[sortConfig.key];
        }

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        const comparison = String(aVal).localeCompare(String(bVal));
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [records, sortConfig]);

  // Paginate
  const paginatedRecords = useMemo(() => {
    const start = page * pageSize;
    return processedRecords.slice(start, start + pageSize);
  }, [processedRecords, page, pageSize]);

  const totalPages = Math.ceil(processedRecords.length / pageSize);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc'
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRecords.map((r) => r.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRowClick = (record: DataRecord) => {
    inspectRecord(record.id);
  };

  const handleCreateRecord = () => {
    if (definitionId) {
      openOverlay('create-record', { definitionId });
    }
  };

  const handleDuplicateRecord = (e: React.MouseEvent, record: DataRecord) => {
    e.stopPropagation();
    openOverlay('create-record', {
      definitionId: record.definition_id,
      prefillData: record.data,
      prefillName: `${record.unique_name} (copy)`,
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    openOverlay('confirm-delete', {
      title: 'Delete Records',
      message: `Are you sure you want to delete ${selectedIds.size} record${
        selectedIds.size > 1 ? 's' : ''
      }? This action cannot be undone.`,
      onConfirm: async () => {
        await bulkDelete.mutateAsync([...selectedIds]);
        setSelectedIds(new Set());
      },
    });
  };

  const handleBulkClassify = () => {
    if (selectedIds.size === 0) return;
    openOverlay('classify-records', {
      recordIds: [...selectedIds],
      onSuccess: () => setSelectedIds(new Set()),
    });
  };


  const getCellValue = (record: DataRecord, key: string): string => {
    if (key === 'unique_name') {
      return record.unique_name;
    }
    const data = record.data as Record<string, unknown>;
    const value = data?.[key];
    if (value === undefined || value === null) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Get definition name for display
  const getDefinitionName = (defId: string): string => {
    const def = allDefinitions?.find((d) => d.id === defId);
    return def?.name || 'Unknown';
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search records..."
              className="w-64 pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Bulk actions */}
          {hasSelection && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
              <span className="text-sm text-slate-500">
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleBulkClassify}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                <FolderOpen size={12} />
                Classify
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDelete.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Record count */}
          <span className="text-sm text-slate-400">
            {processedRecords.length} record{processedRecords.length !== 1 ? 's' : ''}
          </span>

          {/* Create button */}
          {definitionId && (
            <button
              onClick={handleCreateRecord}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              New {definition?.name || 'Record'}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full" />
          </div>
        ) : paginatedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <FolderOpen size={48} className="mb-3 opacity-50" />
            <p className="text-lg font-medium">No records found</p>
            <p className="text-sm mt-1">
              {searchQuery
                ? 'Try a different search term'
                : definitionId
                ? 'Create your first record'
                : 'Select a type from the sidebar'}
            </p>
            {definitionId && !searchQuery && (
              <button
                onClick={handleCreateRecord}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Create Record
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr>
                {/* Checkbox column */}
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      paginatedRecords.length > 0 &&
                      selectedIds.size === paginatedRecords.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>

                {/* Type column (only when showing all) */}
                {!definitionId && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Type
                  </th>
                )}

                {/* Dynamic columns */}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortConfig?.key === col.key && (
                        <ArrowUpDown
                          size={12}
                          className={clsx(
                            'transition-transform',
                            sortConfig.direction === 'desc' && 'rotate-180'
                          )}
                        />
                      )}
                    </div>
                  </th>
                ))}

                {/* Actions column */}
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((record) => {
                const isSelected = selectedIds.has(record.id);
                return (
                  <tr
                    key={record.id}
                    onClick={() => handleRowClick(record)}
                    className={clsx(
                      'border-b border-slate-100 cursor-pointer transition-colors',
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    )}
                  >
                    {/* Checkbox */}
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(record.id)}
                        className="rounded border-slate-300"
                      />
                    </td>

                    {/* Type badge (only when showing all) */}
                    {!definitionId && (
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {getDefinitionName(record.definition_id)}
                        </span>
                      </td>
                    )}

                    {/* Dynamic cells */}
                    {columns.map((col) => {
                      const data = record.data as Record<string, unknown>;
                      // Check if this is an image field
                      if (isImageField(col.type, col.key)) {
                        const value = data?.[col.key];
                        const artifactId = data?.artifact_id as string | undefined;
                        return (
                          <td key={col.key} className="px-4 py-3">
                            <ImageFieldRenderer
                              value={value as string | undefined}
                              artifactId={artifactId}
                              size="sm"
                            />
                          </td>
                        );
                      }
                      return (
                        <td
                          key={col.key}
                          className="px-4 py-3 text-sm text-slate-700 truncate max-w-xs"
                        >
                          {getCellValue(record, col.key)}
                        </td>
                      );
                    })}

                    {/* Actions */}
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleDuplicateRecord(e, record)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Duplicate record"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => {
                            openOverlay('view-definition', { recordId: record.id });
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          title="More options"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="h-12 border-t border-slate-200 flex items-center justify-between px-4 bg-slate-50">
          <span className="text-sm text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
