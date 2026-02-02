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
                'text-sm text-ws-text-secondary transition-colors',
                'border-t border-ws-panel-border',
                disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-ws-bg hover:text-ws-text-secondary',
                className
            )}
        >
            <Plus size={14} />
            <span>Add {label}</span>
        </button>
    );
}
