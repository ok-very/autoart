import { useState, useMemo, useCallback } from 'react';

interface UseTablePaginationOptions {
    /** Items per page */
    pageSize?: number;
    /** Initial page (0-indexed) */
    initialPage?: number;
}

interface UseTablePaginationResult<T> {
    /** Current page (0-indexed) */
    page: number;
    /** Total number of pages */
    totalPages: number;
    /** Items for the current page */
    paginatedItems: T[];
    /** Go to next page */
    nextPage: () => void;
    /** Go to previous page */
    prevPage: () => void;
    /** Go to a specific page */
    goToPage: (page: number) => void;
    /** Reset to first page */
    resetPage: () => void;
    /** Whether there's a previous page */
    hasPrevPage: boolean;
    /** Whether there's a next page */
    hasNextPage: boolean;
    /** Page size */
    pageSize: number;
}

/**
 * Shared hook for table pagination.
 *
 * Provides consistent pagination behavior with prev/next navigation.
 * Used by DataTableFlat for large record sets.
 */
export function useTablePagination<T>(
    items: T[],
    options: UseTablePaginationOptions = {}
): UseTablePaginationResult<T> {
    const { pageSize = 50, initialPage = 0 } = options;
    const [page, setPage] = useState(initialPage);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(items.length / pageSize)),
        [items.length, pageSize]
    );

    // Clamp page to valid range when items change
    const clampedPage = useMemo(
        () => Math.min(page, totalPages - 1),
        [page, totalPages]
    );

    const paginatedItems = useMemo(() => {
        const start = clampedPage * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, clampedPage, pageSize]);

    const nextPage = useCallback(() => {
        setPage((p) => Math.min(totalPages - 1, p + 1));
    }, [totalPages]);

    const prevPage = useCallback(() => {
        setPage((p) => Math.max(0, p - 1));
    }, []);

    const goToPage = useCallback(
        (newPage: number) => {
            setPage(Math.max(0, Math.min(totalPages - 1, newPage)));
        },
        [totalPages]
    );

    const resetPage = useCallback(() => {
        setPage(0);
    }, []);

    return {
        page: clampedPage,
        totalPages,
        paginatedItems,
        nextPage,
        prevPage,
        goToPage,
        resetPage,
        hasPrevPage: clampedPage > 0,
        hasNextPage: clampedPage < totalPages - 1,
        pageSize,
    };
}
