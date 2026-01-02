import { useState, useCallback } from 'react';

interface UseTableRowExpansionOptions {
    /** Initial expanded IDs */
    initialExpanded?: Set<string>;
}

interface UseTableRowExpansionResult {
    /** Currently expanded IDs */
    expandedIds: Set<string>;
    /** Check if a row is expanded */
    isExpanded: (id: string) => boolean;
    /** Toggle expansion for a row */
    toggleExpanded: (id: string) => void;
    /** Expand a row */
    expand: (id: string) => void;
    /** Collapse a row */
    collapse: (id: string) => void;
    /** Collapse all rows */
    collapseAll: () => void;
    /** Expand all rows */
    expandAll: (ids: string[]) => void;
}

/**
 * Shared hook for table row expansion.
 *
 * Provides consistent expand/collapse behavior for detailed row views.
 * Used by DataTableHierarchy for showing additional fields.
 */
export function useTableRowExpansion(
    options: UseTableRowExpansionOptions = {}
): UseTableRowExpansionResult {
    const { initialExpanded = new Set() } = options;
    const [expandedIds, setExpandedIds] = useState<Set<string>>(initialExpanded);

    const isExpanded = useCallback(
        (id: string) => expandedIds.has(id),
        [expandedIds]
    );

    const toggleExpanded = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const expand = useCallback((id: string) => {
        setExpandedIds((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    const collapse = useCallback((id: string) => {
        setExpandedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const collapseAll = useCallback(() => {
        setExpandedIds(new Set());
    }, []);

    const expandAll = useCallback((ids: string[]) => {
        setExpandedIds(new Set(ids));
    }, []);

    return {
        expandedIds,
        isExpanded,
        toggleExpanded,
        expand,
        collapse,
        collapseAll,
        expandAll,
    };
}
