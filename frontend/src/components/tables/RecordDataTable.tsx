import { useMemo, useCallback } from 'react';
import { DataTable, type TableColumn } from './DataTable';
import { DataFieldWidget, type DataFieldKind } from '../common/DataFieldWidget';
import type { DataRecord, RecordDefinition, FieldDef } from '../../types';
import { useUpdateRecord } from '../../api/hooks';

// ==================== TYPES ====================

export interface RecordDataTableProps {
    /** Record definition (provides schema and styling) */
    definition: RecordDefinition;
    /** Array of records to display */
    records: DataRecord[];
    /** Currently selected record ID */
    selectedRecordId?: string | null;
    /** Selection handler */
    onSelectRecord?: (recordId: string) => void;
    /** Handler to open create record drawer */
    onAddRecord?: () => void;
    /** Custom className */
    className?: string;
    /** Whether the table is compact */
    compact?: boolean;
}

// ==================== RECORD DATA TABLE ====================

/**
 * RecordDataTable - A specialized DataTable for DataRecord items
 *
 * Features:
 * - Schema-driven columns from definition.schema_config.fields
 * - Inline editing with automatic API save
 * - Title from definition with icon
 * - Nestable for floating tables in workflow view
 */
export function RecordDataTable({
    definition,
    records,
    selectedRecordId,
    onSelectRecord,
    onAddRecord,
    className,
    compact = true,
}: RecordDataTableProps) {
    const updateRecord = useUpdateRecord();
    const fields = definition.schema_config?.fields || [];

    // Build columns from definition fields
    const columns = useMemo<TableColumn<DataRecord>[]>(() => {
        // Name column (always first)
        const nameColumn: TableColumn<DataRecord> = {
            key: 'unique_name',
            label: 'Name',
            width: 200,
            sortable: true,
            editable: true,
            field: { key: 'unique_name', type: 'text', label: 'Name' },
            renderCell: (record) => (
                <div className="text-sm font-medium text-slate-800 truncate" title={record.unique_name}>
                    {record.unique_name}
                </div>
            ),
        };

        // Dynamic columns from definition schema
        const fieldColumns = fields.map((field): TableColumn<DataRecord> => {
            const renderAs = ((field as FieldDef & { renderAs?: string }).renderAs || field.type || 'text') as DataFieldKind;

            return {
                key: field.key,
                label: field.label,
                width: 120,
                field: field as FieldDef & { renderAs?: string },
                sortable: ['text', 'number', 'date', 'status'].includes(field.type),
                editable: true,
                renderCell: (record) => {
                    const value = record.data?.[field.key];
                    return <DataFieldWidget kind={renderAs} value={value} />;
                },
            };
        });

        return [nameColumn, ...fieldColumns];
    }, [fields]);

    // Handle cell value changes - update record via API
    const handleCellChange = useCallback(
        (recordId: string, key: string, value: unknown) => {
            const record = records.find((r) => r.id === recordId);
            if (!record) return;

            // Special handling for unique_name
            if (key === 'unique_name') {
                updateRecord.mutate({ id: recordId, unique_name: String(value) });
                return;
            }

            // All other fields go into data object
            const updatedData = { ...record.data, [key]: value };
            updateRecord.mutate({ id: recordId, data: updatedData });
        },
        [records, updateRecord]
    );

    return (
        <DataTable<DataRecord>
            data={records}
            columns={columns}
            getRowKey={(record) => record.id}
            selectedRowId={selectedRecordId}
            onRowSelect={(id) => onSelectRecord?.(id)}
            onCellChange={handleCellChange}
            title={`${definition.name} Records`}
            icon={definition.styling?.icon}
            showAddButton={!!onAddRecord}
            onAddRow={onAddRecord}
            emptyMessage="No records yet."
            className={className}
            compact={compact}
            stickyHeader
        />
    );
}
