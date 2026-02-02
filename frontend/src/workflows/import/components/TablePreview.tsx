/**
 * TablePreview
 *
 * Spreadsheet view of import items showing records as they will appear.
 * Uses field recordings with renderHint for semantic display.
 *
 * Now built on TableKit for consistent visual grammar.
 */

import { Table as TableIcon } from 'lucide-react';
import { useMemo } from 'react';

import type { ImportPlan } from '../../../api/hooks/imports';
import { Badge } from '@autoart/ui';
import { DataFieldWidget, type DataFieldKind } from '../../../ui/molecules/DataFieldWidget';
import { TableFrame, TableHeaderRow, TableRow, TableHeaderCell, TableCell } from '../../../ui/table';

interface TablePreviewProps {
    plan: ImportPlan;
    selectedRecordId: string | null;
    onSelect: (recordId: string) => void;
}

export function TablePreview({ plan, selectedRecordId, onSelect }: TablePreviewProps) {
    // Collect all unique field names from all items
    const columns = useMemo(() => {
        const fieldSet = new Map<string, string>(); // fieldName -> renderHint

        for (const item of plan.items) {
            if (!item.fieldRecordings) continue;
            for (const fr of item.fieldRecordings) {
                if (!fieldSet.has(fr.fieldName)) {
                    fieldSet.set(fr.fieldName, fr.renderHint || 'text');
                }
            }
        }

        return Array.from(fieldSet.entries()).map(([name, hint]) => ({
            key: name,
            label: name,
            renderHint: hint as DataFieldKind,
        }));
    }, [plan.items]);

    // Build rows from items
    const rows = useMemo(() => {
        return plan.items.map((item) => {
            const row: Record<string, unknown> = { _id: item.tempId };

            if (item.fieldRecordings) {
                for (const fr of item.fieldRecordings) {
                    row[fr.fieldName] = fr.value;
                }
            }

            // Add title
            row._title = item.title || item.tempId;

            return row;
        });
    }, [plan.items]);

    if (rows.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <TableIcon className="w-12 h-12 text-ws-muted mx-auto mb-3" />
                    <p className="text-ws-text-secondary font-medium">No items to display</p>
                </div>
            </div>
        );
    }

    return (
        <TableFrame className="flex-1" shadow={false}>
            <div className="overflow-auto h-full">
                {/* Header Row */}
                <TableHeaderRow size="sm" sticky>
                    <TableHeaderCell width={200}>Title</TableHeaderCell>
                    {columns.map((col) => (
                        <TableHeaderCell key={col.key} width="flex">
                            <span className="flex items-center gap-1.5">
                                {col.label}
                                <Badge variant="light" className="font-mono text-[9px]">
                                    {col.renderHint}
                                </Badge>
                            </span>
                        </TableHeaderCell>
                    ))}
                </TableHeaderRow>

                {/* Data Rows */}
                {rows.map((row) => {
                    const rowId = String(row._id);
                    const isSelected = rowId === selectedRecordId;

                    return (
                        <TableRow
                            key={rowId}
                            size="sm"
                            selected={isSelected}
                            onClick={() => onSelect(rowId)}
                        >
                            <TableCell width={200} className="font-medium text-ws-fg">
                                {String(row._title)}
                            </TableCell>
                            {columns.map((col) => (
                                <TableCell key={col.key} width="flex">
                                    <DataFieldWidget
                                        kind={col.renderHint}
                                        value={row[col.key]}
                                    />
                                </TableCell>
                            ))}
                        </TableRow>
                    );
                })}
            </div>
        </TableFrame>
    );
}

export default TablePreview;
