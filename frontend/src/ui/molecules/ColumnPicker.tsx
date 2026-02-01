/**
 * ColumnPicker - Toggle visibility of table columns
 *
 * A dropdown picker for showing/hiding table columns.
 * Generic enough to work with any field definition that has a fieldName.
 */

import { Columns } from 'lucide-react';

import { Dropdown, DropdownTrigger, DropdownContent, DropdownCheckboxItem, DropdownLabel } from '@autoart/ui';

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
    return (
        <Dropdown>
            <DropdownTrigger asChild>
                <button
                    className="p-2 rounded hover:bg-slate-100 text-slate-500"
                    title="Toggle columns"
                >
                    <Columns size={16} />
                </button>
            </DropdownTrigger>
            <DropdownContent align="end" className="w-48 max-h-64 overflow-y-auto">
                <DropdownLabel>{title}</DropdownLabel>
                {allFields.map((field) => {
                    const label = field.label || field.fieldName;
                    return (
                        <DropdownCheckboxItem
                            key={field.fieldName}
                            checked={visibleKeys.has(field.fieldName)}
                            onCheckedChange={() => onToggle(field.fieldName)}
                        >
                            <span className="truncate">{label}</span>
                        </DropdownCheckboxItem>
                    );
                })}
                {allFields.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-400">
                        No columns available
                    </div>
                )}
            </DropdownContent>
        </Dropdown>
    );
}

export default ColumnPicker;
