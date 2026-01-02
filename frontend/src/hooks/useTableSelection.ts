import { useState, useCallback } from 'react';

interface UseTableSelectionOptions {
    /** Initial selected IDs */
    initialSelected?: Set<string>;
    /** Callback when selection changes */
    onSelectionChange?: (selectedIds: Set<string>) => void;
}

interface UseTableSelectionResult {
    /** Currently selected IDs */
    selectedIds: Set<string>;
    /** Check if an item is selected */
    isSelected: (id: string) => boolean;
    /** Toggle selection for a single item */
    toggleOne: (id: string) => void;
    /** Select or deselect all items in the current view */
    toggleAll: (ids: string[]) => void;
    /** Check if all provided IDs are selected */
    areAllSelected: (ids: string[]) => boolean;
    /** Clear all selections */
    clearSelection: () => void;
    /** Set selection directly */
    setSelectedIds: (ids: Set<string>) => void;
}

/**
 * Shared hook for table row selection.
 *
 * Provides consistent multi-select behavior with toggle semantics.
 * Used by DataTableFlat for bulk operations.
 */
export function useTableSelection(
    options: UseTableSelectionOptions = {}
): UseTableSelectionResult {
    const { initialSelected = new Set(), onSelectionChange } = options;
    const [selectedIds, setSelectedIdsInternal] = useState<Set<string>>(initialSelected);

    const setSelectedIds = useCallback(
        (ids: Set<string>) => {
            setSelectedIdsInternal(ids);
            onSelectionChange?.(ids);
        },
        [onSelectionChange]
    );

    const isSelected = useCallback(
        (id: string) => selectedIds.has(id),
        [selectedIds]
    );

    const toggleOne = useCallback(
        (id: string) => {
            const next = new Set(selectedIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            setSelectedIds(next);
        },
        [selectedIds, setSelectedIds]
    );

    const toggleAll = useCallback(
        (ids: string[]) => {
            const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
            const next = allSelected ? new Set<string>() : new Set(ids);
            setSelectedIds(next);
        },
        [selectedIds, setSelectedIds]
    );

    const areAllSelected = useCallback(
        (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
        [selectedIds]
    );

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, [setSelectedIds]);

    return {
        selectedIds,
        isSelected,
        toggleOne,
        toggleAll,
        areAllSelected,
        clearSelection,
        setSelectedIds,
    };
}
