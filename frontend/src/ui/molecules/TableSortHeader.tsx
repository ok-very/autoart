/**
 * TableSortHeader - Reusable sortable column header
 *
 * Provides consistent sort indicator UI for table column headers.
 */

import { clsx } from 'clsx';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

import type { SortConfig } from '../../hooks';

export interface TableSortHeaderProps {
    /** Column key for sorting */
    columnKey: string;
    /** Display label */
    label: string;
    /** Whether this column is sortable */
    sortable?: boolean;
    /** Current sort configuration */
    sortConfig: SortConfig;
    /** Callback when sort is toggled */
    onSort: (key: string) => void;
    /** Alignment */
    align?: 'left' | 'center' | 'right';
    /** Additional className */
    className?: string;
}

/**
 * Sortable column header with sort direction indicators.
 *
 * Shows:
 * - Muted ArrowUpDown when sortable but not active
 * - ChevronUp/ChevronDown when actively sorted
 */
export function TableSortHeader({
    columnKey,
    label,
    sortable = true,
    sortConfig,
    onSort,
    align = 'left',
    className,
}: TableSortHeaderProps) {
    const isActive = sortConfig?.key === columnKey;
    const direction = isActive ? sortConfig.direction : null;

    return (
        <div
            onClick={sortable ? () => onSort(columnKey) : undefined}
            className={clsx(
                'flex items-center gap-1',
                sortable && 'cursor-pointer hover:bg-slate-100',
                align === 'center' && 'justify-center',
                align === 'right' && 'justify-end',
                className
            )}
        >
            <span className="truncate">{label}</span>
            {sortable && (
                <>
                    {isActive ? (
                        direction === 'asc' ? (
                            <ChevronUp size={12} className="text-blue-500 shrink-0" />
                        ) : (
                            <ChevronDown size={12} className="text-blue-500 shrink-0" />
                        )
                    ) : (
                        <ArrowUpDown size={10} className="text-slate-300 shrink-0" />
                    )}
                </>
            )}
        </div>
    );
}
