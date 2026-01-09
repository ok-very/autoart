/**
 * TablePreview
 *
 * Spreadsheet view of import items showing records as they will appear.
 * Uses field recordings with renderHint for semantic display.
 */

import { useMemo } from 'react';
import { Table } from 'lucide-react';
import { DataFieldWidget, type DataFieldKind } from '../../ui/molecules/DataFieldWidget';
import type { ImportPlan } from '../../api/hooks/imports';

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
                    <Table className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No items to display</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200">
                            Title
                        </th>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span>{col.label}</span>
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                                        {col.renderHint}
                                    </span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const rowId = String(row._id);
                        const isSelected = rowId === selectedRecordId;

                        return (
                            <tr
                                key={rowId}
                                onClick={() => onSelect(rowId)}
                                className={`cursor-pointer border-b border-slate-100 transition-colors ${isSelected
                                        ? 'bg-blue-50 hover:bg-blue-100'
                                        : 'hover:bg-slate-50'
                                    }`}
                            >
                                <td className="px-3 py-2 font-medium text-slate-800">
                                    {String(row._title)}
                                </td>
                                {columns.map((col) => (
                                    <td key={col.key} className="px-3 py-2 text-slate-600">
                                        <DataFieldWidget
                                            kind={col.renderHint}
                                            value={row[col.key]}
                                        />
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default TablePreview;
