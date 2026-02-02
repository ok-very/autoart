/**
 * FieldSchemaPreview
 *
 * Displays field schema in the Import Workbench using DataTable.
 * Shows:
 * - For pre-acceptance: proposed definition fields from schemaMatch
 * - Post-acceptance: matched definition fields (floating definition)
 *
 * Renders field recordings with their type information.
 */

import { TableProperties, AlertCircle, CheckCircle } from 'lucide-react';
import { useMemo } from 'react';

import type { ImportPlanItem } from '../../../api/hooks/imports';
import { DataTable, type TableColumn } from '../../../ui/tables/DataTable';

// ============================================================================
// TYPES
// ============================================================================

interface FieldSchemaPreviewProps {
    /** The import plan item with field recordings */
    item: ImportPlanItem;
    /** Schema match result from classification */
    schemaMatch?: {
        definitionId: string | null;
        definitionName: string | null;
        matchScore: number;
        proposedDefinition?: {
            name: string;
            schemaConfig: { fields: Array<{ key: string; type: string; label: string }> };
        };
    };
    /** Compact mode for inline display */
    compact?: boolean;
}

// Internal row type for the table
interface FieldRow {
    id: string;
    fieldName: string;
    value: unknown;
    renderHint?: string;
    matchedType?: string;
    matchedLabel?: string;
    status: 'matched' | 'proposed' | 'unmapped';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FieldSchemaPreview({ item, schemaMatch, compact = false }: FieldSchemaPreviewProps) {
    // Derive rows from field recordings + schema match
    const rows = useMemo<FieldRow[]>(() => {
        if (!item.fieldRecordings || item.fieldRecordings.length === 0) {
            return [];
        }

        // Get matched or proposed fields for mapping
        const definitionFields = schemaMatch?.proposedDefinition?.schemaConfig?.fields || [];
        const fieldMap = new Map(definitionFields.map(f => [f.key.toLowerCase(), f]));

        return item.fieldRecordings.map((fr, idx) => {
            // Try to find matching field in proposed/matched definition
            const normalizedKey = fr.fieldName.toLowerCase().replace(/[\s_-]+/g, '');
            const matchedField = fieldMap.get(normalizedKey) ||
                definitionFields.find(f =>
                    f.label.toLowerCase().replace(/[\s_-]+/g, '') === normalizedKey ||
                    f.key.toLowerCase().replace(/[\s_-]+/g, '') === normalizedKey
                );

            let status: FieldRow['status'] = 'unmapped';
            if (schemaMatch?.matchScore && schemaMatch.matchScore >= 0.7) {
                status = 'matched';
            } else if (schemaMatch?.proposedDefinition) {
                status = 'proposed';
            }

            return {
                id: `${idx}`,
                fieldName: fr.fieldName,
                value: fr.value,
                renderHint: fr.renderHint,
                matchedType: matchedField?.type,
                matchedLabel: matchedField?.label,
                status,
            };
        });
    }, [item.fieldRecordings, schemaMatch]);

    // Define columns for the table
    const columns = useMemo<TableColumn<FieldRow>[]>(() => [
        {
            key: 'fieldName',
            label: 'Field',
            width: 120,
            renderCell: (row: FieldRow) => (
                <div className="flex items-center gap-1.5">
                    <span className="font-medium text-ws-text-secondary">{row.fieldName}</span>
                    {row.renderHint && (
                        <span className="text-[10px] font-mono text-ws-muted bg-slate-100 px-1 rounded">
                            {row.renderHint}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'value',
            label: 'Value',
            width: 'flex',
            renderCell: (row: FieldRow) => (
                <span className="text-ws-text-secondary truncate block">
                    {row.value === null || row.value === undefined
                        ? <span className="text-ws-muted italic">empty</span>
                        : String(row.value)}
                </span>
            ),
        },
        {
            key: 'matchedType',
            label: 'Schema Type',
            width: 100,
            renderCell: (row: FieldRow) => (
                <div className="flex items-center gap-1">
                    {row.status === 'matched' ? (
                        <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                    ) : row.status === 'proposed' ? (
                        <AlertCircle size={12} className="text-amber-500 flex-shrink-0" />
                    ) : null}
                    <span className={`text-xs font-mono ${row.status === 'matched' ? 'text-green-700' :
                        row.status === 'proposed' ? 'text-amber-700' : 'text-ws-muted'
                        }`}>
                        {row.matchedType || row.renderHint || 'text'}
                    </span>
                </div>
            ),
        },
    ], []);

    if (rows.length === 0) {
        return (
            <div className="p-4 text-center text-ws-muted text-sm">
                No field recordings
            </div>
        );
    }

    // Match info header
    const matchHeader = schemaMatch ? (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-t border border-b-0 ${schemaMatch.matchScore >= 0.7
            ? 'bg-green-50 border-green-200'
            : schemaMatch.proposedDefinition
                ? 'bg-amber-50 border-amber-200'
                : 'bg-ws-bg border-ws-panel-border'
            }`}>
            <TableProperties size={14} className={
                schemaMatch.matchScore >= 0.7 ? 'text-green-600' :
                    schemaMatch.proposedDefinition ? 'text-amber-600' : 'text-ws-text-secondary'
            } />
            <span className={`text-xs font-medium ${schemaMatch.matchScore >= 0.7 ? 'text-green-700' :
                schemaMatch.proposedDefinition ? 'text-amber-700' : 'text-ws-text-secondary'
                }`}>
                {schemaMatch.matchScore >= 0.7 ? (
                    <>Matched: <span className="font-semibold">{schemaMatch.definitionName}</span> ({Math.round(schemaMatch.matchScore * 100)}%)</>
                ) : schemaMatch.proposedDefinition ? (
                    <>Proposed: <span className="font-semibold">{schemaMatch.proposedDefinition.name}</span></>
                ) : (
                    'No schema match'
                )}
            </span>
        </div>
    ) : null;

    return (
        <div className="flex flex-col">
            {matchHeader}
            <div className={`border rounded-b ${matchHeader ? 'border-t-0' : 'rounded-t'} border-ws-panel-border overflow-hidden`}>
                <DataTable<FieldRow>
                    data={rows}
                    columns={columns}
                    getRowKey={(row: FieldRow) => row.id}
                    compact={compact}
                    emptyMessage="No field recordings"
                    stickyHeader={false}
                    className="text-xs"
                />
            </div>
        </div>
    );
}

export default FieldSchemaPreview;
