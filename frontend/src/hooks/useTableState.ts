import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
    type VisibilityState,
} from '@tanstack/react-table';
import { useState } from 'react';

export interface UseTableStateOptions<TData> {
    data: TData[];
    columns: ColumnDef<TData, any>[];
    initialSorting?: SortingState;
    initialColumnFilters?: ColumnFiltersState;
    initialColumnVisibility?: VisibilityState;
    initialGlobalFilter?: string;
    /** When true, skip client-side filtering (for server-side filtering) */
    manualFiltering?: boolean;
    /** When true, skip client-side sorting (for server-side sorting) */
    manualSorting?: boolean;
}

/**
 * useTableState - Creates a TanStack Table instance with filtering, sorting, and pagination
 *
 * A thin wrapper around useReactTable that provides sensible defaults for
 * client-side table operations. Returns the table instance — callers access
 * filtered/sorted rows via `table.getRowModel().rows` and state via `table.getState()`.
 */
export function useTableState<TData>({
    data,
    columns,
    initialSorting = [],
    initialColumnFilters = [],
    initialColumnVisibility = {},
    initialGlobalFilter = '',
    manualFiltering = false,
    manualSorting = false,
}: UseTableStateOptions<TData>) {
    const [sorting, setSorting] = useState<SortingState>(initialSorting);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialColumnFilters);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility);
    const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
        getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        manualFiltering,
        manualSorting,
    });

    return table;
}
