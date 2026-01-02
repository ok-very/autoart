import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';
export type SortConfig = { key: string; direction: SortDirection } | null;

interface UseTableSortOptions<T> {
    /** Initial sort configuration */
    initialSort?: SortConfig;
    /** Custom value getter for a field */
    getFieldValue?: (item: T, key: string) => unknown;
}

interface UseTableSortResult<T> {
    /** Current sort configuration */
    sortConfig: SortConfig;
    /** Sorted items */
    sortedItems: T[];
    /** Toggle sort for a column */
    toggleSort: (key: string) => void;
    /** Clear sort */
    clearSort: () => void;
    /** Set sort configuration directly */
    setSortConfig: (config: SortConfig) => void;
}

/**
 * Shared hook for table sorting logic.
 *
 * Provides consistent sorting behavior across DataTableHierarchy and DataTableFlat.
 * Supports three-state toggle: asc -> desc -> null (clear).
 */
export function useTableSort<T>(
    items: T[],
    options: UseTableSortOptions<T> = {}
): UseTableSortResult<T> {
    const { initialSort = null, getFieldValue } = options;
    const [sortConfig, setSortConfig] = useState<SortConfig>(initialSort);

    // Toggle sort: asc -> desc -> null
    const toggleSort = useCallback((key: string) => {
        setSortConfig((prev) => {
            if (prev?.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                return null; // Clear sort
            }
            return { key, direction: 'asc' };
        });
    }, []);

    const clearSort = useCallback(() => {
        setSortConfig(null);
    }, []);

    // Sort items based on current config
    const sortedItems = useMemo(() => {
        if (!sortConfig) return items;

        return [...items].sort((a, b) => {
            let aVal: unknown;
            let bVal: unknown;

            if (getFieldValue) {
                aVal = getFieldValue(a, sortConfig.key);
                bVal = getFieldValue(b, sortConfig.key);
            } else {
                // Default: assume items are objects with direct properties
                aVal = (a as Record<string, unknown>)[sortConfig.key];
                bVal = (b as Record<string, unknown>)[sortConfig.key];
            }

            // Handle nulls - push to end
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // String comparison
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const cmp = aVal.localeCompare(bVal);
                return sortConfig.direction === 'asc' ? cmp : -cmp;
            }

            // Number comparison
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Date comparison
            if (aVal instanceof Date && bVal instanceof Date) {
                const cmp = aVal.getTime() - bVal.getTime();
                return sortConfig.direction === 'asc' ? cmp : -cmp;
            }

            // Fallback to string comparison
            const cmp = String(aVal).localeCompare(String(bVal));
            return sortConfig.direction === 'asc' ? cmp : -cmp;
        });
    }, [items, sortConfig, getFieldValue]);

    return {
        sortConfig,
        sortedItems,
        toggleSort,
        clearSort,
        setSortConfig,
    };
}
