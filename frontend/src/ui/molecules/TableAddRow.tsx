/**
 * TableAddRow - Reusable "Add" button row for tables
 *
 * Provides consistent "+ Add [item]" button styling across tables.
 */

import { clsx } from 'clsx';
import { Plus } from 'lucide-react';

export interface TableAddRowProps {
    /** Button label (e.g., "Item", "Task", "Record") */
    label?: string;
    /** Click handler */
    onClick: () => void;
    /** Disabled state */
    disabled?: boolean;
    /** Additional className */
    className?: string;
}

/**
 * Full-width add button typically placed at the bottom of a table.
 *
 * Styling matches the existing DataTableHierarchy "Add Item" button.
 */
export function TableAddRow({
    label = 'Item',
    onClick,
    disabled = false,
    className,
}: TableAddRowProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={clsx(
                'w-full flex items-center justify-center gap-2 py-2',
                'text-sm text-slate-500 transition-colors',
                'border-t border-slate-200',
                disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-slate-50 hover:text-slate-700',
                className
            )}
        >
            <Plus size={14} />
            <span>Add {label}</span>
        </button>
    );
}
