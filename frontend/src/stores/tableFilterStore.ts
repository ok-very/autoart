import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VisibilityState, SortingState } from '@tanstack/react-table';

interface TableFilterState {
  columnVisibility: Record<string, VisibilityState>;
  sorting: Record<string, SortingState>;
  setColumnVisibility: (definitionId: string, visibility: VisibilityState) => void;
  setSorting: (definitionId: string, sorting: SortingState) => void;
  getColumnVisibility: (definitionId: string) => VisibilityState;
  getSorting: (definitionId: string) => SortingState;
}

export const useTableFilterStore = create<TableFilterState>()(
  persist(
    (set, get) => ({
      columnVisibility: {},
      sorting: {},

      setColumnVisibility: (definitionId, visibility) =>
        set((state) => ({
          columnVisibility: { ...state.columnVisibility, [definitionId]: visibility },
        })),

      setSorting: (definitionId, sorting) =>
        set((state) => ({
          sorting: { ...state.sorting, [definitionId]: sorting },
        })),

      getColumnVisibility: (definitionId) => get().columnVisibility[definitionId] ?? {},

      getSorting: (definitionId) => get().sorting[definitionId] ?? [],
    }),
    {
      name: 'table-filter-storage',
      version: 1,
      partialize: (state) => ({
        columnVisibility: state.columnVisibility,
      }),
    }
  )
);
