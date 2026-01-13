/**
 * ColumnPicker - Toggle visibility of table columns
 *
 * A dropdown picker for showing/hiding table columns.
 * Generic enough to work with any field definition that has a fieldName.
 */

import { Columns } from 'lucide-react';
import { useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ColumnPickerField {
    fieldName: string;
    label?: string;
}

export interface ColumnPickerProps<T extends ColumnPickerField> {
    /** All available fields */
    allFields: T[];
    /** Currently visible field names */
    visibleKeys: Set<string>;
    /** Toggle a field's visibility */
    onToggle: (fieldName: string) => void;
    /** Optional title for the dropdown header */
    title?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ColumnPicker<T extends ColumnPickerField>({
    allFields,
    visibleKeys,
    onToggle,
    title = 'Visible Columns',
}: ColumnPickerProps<T>) {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = useCallback((fieldName: string) => {
        onToggle(fieldName);
    }, [onToggle]);

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
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase">
                            {title}
                        </div>
                        {allFields.map((field) => {
                            const label = field.label || field.fieldName;
                            return (
                                <label
                                    key={field.fieldName}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={visibleKeys.has(field.fieldName)}
                                        onChange={() => handleToggle(field.fieldName)}
                                        className="rounded border-slate-300"
                                    />
                                    <span className="truncate">{label}</span>
                                </label>
                            );
                        })}
                        {allFields.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-400">
                                No columns available
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default ColumnPicker;
