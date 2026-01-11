/**
 * FieldInstancesReview
 *
 * Shows all records using a selected field, with:
 * - Multi-selection filtering
 * - Bulk clear field values
 * - Bulk edit field values
 * - Reuses existing UI elements (DataFieldWidget, Button, etc.)
 *
 * Placed in FieldsPage "Instances" tab.
 * Now built on TableKit for consistent visual grammar.
 */

import { Search, Trash2, Edit3, X } from 'lucide-react';
import { useState, useMemo } from 'react';

import type { FieldDescriptor, DataRecord } from '@autoart/shared';

import { useRecords, useUpdateRecord } from '../../api/hooks';
import { Checkbox } from '../atoms/Checkbox';
import { DataFieldWidget, type DataFieldKind } from '../common/DataFieldWidget';
import { TableFrame, TableHeaderRow, TableRow, TableHeaderCell, TableCell } from '../table';


interface FieldInstancesReviewProps {
    /** The field descriptor selected from Definitions tab */
    field: FieldDescriptor;
}

/**
 * Map field type to DataFieldKind for rendering
 */
function getFieldKind(type: string): DataFieldKind {
    switch (type) {
        case 'status': return 'status';
        case 'user': return 'user';
        case 'date': return 'date';
        case 'percent': return 'percent';
        case 'tags': return 'tags';
        case 'textarea': return 'description';
        default: return 'text';
    }
}

export function FieldInstancesReview({ field }: FieldInstancesReviewProps) {
    // State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    // Data fetching - use the source definition ID to filter records
    const { data: records = [], isLoading } = useRecords(
        field.sourceDefinitionId ? { definitionId: field.sourceDefinitionId } : undefined
    );

    // Mutation for updating records
    const { mutate: updateRecord, isPending: isUpdating } = useUpdateRecord();

    // Filter records by search query
    const filteredRecords = useMemo(() => {
        if (!searchQuery.trim()) return records;
        const query = searchQuery.toLowerCase();
        return records.filter(r => {
            // Search in unique_name and field value
            const name = r.unique_name?.toLowerCase() || '';
            const fieldValue = String(r.data?.[field.fieldKey] || '').toLowerCase();
            return name.includes(query) || fieldValue.includes(query);
        });
    }, [records, searchQuery, field.fieldKey]);

    // Selection handlers
    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredRecords.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRecords.map(r => r.id)));
        }
    };

    // Bulk clear field values
    const handleBulkClear = () => {
        if (selectedIds.size === 0) return;
        const confirmed = window.confirm(`Clear "${field.label}" for ${selectedIds.size} record(s)?`);
        if (!confirmed) return;

        selectedIds.forEach(id => {
            const record = records.find(r => r.id === id);
            if (!record) return;
            const newData = { ...record.data };
            delete newData[field.fieldKey];
            updateRecord({ id, data: newData });
        });
        setSelectedIds(new Set());
    };

    // Bulk edit field values
    const handleBulkEdit = () => {
        if (selectedIds.size === 0) return;
        if (!isEditing) {
            setIsEditing(true);
            setEditValue('');
            return;
        }

        // Apply the edit
        selectedIds.forEach(id => {
            const record = records.find(r => r.id === id);
            if (!record) return;
            const newData = { ...record.data, [field.fieldKey]: editValue };
            updateRecord({ id, data: newData });
        });
        setSelectedIds(new Set());
        setIsEditing(false);
        setEditValue('');
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setEditValue('');
    };

    // Inline single-record edit
    const handleInlineEdit = (record: DataRecord) => {
        const currentValue = String(record.data?.[field.fieldKey] || '');
        const newValue = window.prompt(`Edit "${field.label}":`, currentValue);
        if (newValue !== null && newValue !== currentValue) {
            const newData = { ...record.data, [field.fieldKey]: newValue };
            updateRecord({ id: record.id, data: newData });
        }
    };

    const allSelected = filteredRecords.length > 0 && selectedIds.size === filteredRecords.length;
    const someSelected = selectedIds.size > 0;
    const fieldKind = getFieldKind(field.type);

    if (!field.sourceDefinitionId) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                    <p className="text-lg font-medium text-slate-600">Node Metadata Field</p>
                    <p className="text-sm mt-1">
                        This field appears in hierarchy nodes, not records.
                    </p>
                    <p className="text-xs mt-4 text-slate-400">
                        Instance browsing for node fields is coming soon.
                    </p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="animate-pulse">Loading instances...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-white">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">
                        {field.label} Instances
                    </h2>
                    <div className="text-xs text-slate-400">
                        {records.length} record(s) - {filteredRecords.length} shown
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter by name or value..."
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {someSelected && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-4">
                    <span className="text-sm text-blue-800 font-medium">
                        {selectedIds.size} selected
                    </span>

                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder="New value..."
                                autoFocus
                                className="px-3 py-1.5 border border-blue-300 rounded text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleBulkEdit}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                Apply
                            </button>
                            <button
                                onClick={cancelEdit}
                                className="p-1.5 text-slate-500 hover:text-slate-700"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={handleBulkClear}
                                disabled={isUpdating}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            >
                                <Trash2 size={14} />
                                Clear Selected
                            </button>
                            <button
                                onClick={handleBulkEdit}
                                disabled={isUpdating}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                            >
                                <Edit3 size={14} />
                                Edit Selected
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {filteredRecords.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <p>No records found</p>
                    </div>
                ) : (
                    <TableFrame shadow={false} className="h-full">
                        {/* Header Row */}
                        <TableHeaderRow size="sm" sticky>
                            <TableCell width={48} className="justify-center">
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={toggleSelectAll}
                                />
                            </TableCell>
                            <TableHeaderCell width="flex">Record Name</TableHeaderCell>
                            <TableHeaderCell width="flex">{field.label} Value</TableHeaderCell>
                            <TableCell width={64} />
                        </TableHeaderRow>

                        {/* Data Rows */}
                        {filteredRecords.map(record => {
                            const value = record.data?.[field.fieldKey];
                            const isSelected = selectedIds.has(record.id);

                            return (
                                <TableRow
                                    key={record.id}
                                    size="sm"
                                    selected={isSelected}
                                    onClick={() => toggleSelection(record.id)}
                                >
                                    <TableCell width={48} className="justify-center" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={isSelected}
                                            onChange={() => toggleSelection(record.id)}
                                        />
                                    </TableCell>
                                    <TableCell width="flex" className="font-medium">
                                        {record.unique_name}
                                    </TableCell>
                                    <TableCell width="flex">
                                        <DataFieldWidget
                                            kind={fieldKind}
                                            value={value}
                                            className="max-w-xs"
                                        />
                                    </TableCell>
                                    <TableCell width={64} className="justify-center" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleInlineEdit(record)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Edit value"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableFrame>
                )}
            </div>
        </div>
    );
}
