/**
 * Export Queue Store
 *
 * Zustand store for Export Queue UI state.
 * Only persists filter preferences, not server data.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { PackageStatus } from '@autoart/shared';

type StatusFilter = PackageStatus | 'all';

interface ExportQueueState {
    activePackageId: string | null;
    filterStatus: StatusFilter;

    setActivePackage: (id: string | null) => void;
    setFilterStatus: (status: StatusFilter) => void;
    reset: () => void;
}

export const useExportQueueStore = create<ExportQueueState>()(
    persist(
        (set) => ({
            activePackageId: null,
            filterStatus: 'all',

            setActivePackage: (activePackageId) => set({ activePackageId }),
            setFilterStatus: (filterStatus) => set({ filterStatus }),
            reset: () => set({ activePackageId: null, filterStatus: 'all' }),
        }),
        {
            name: 'export-queue-storage',
            version: 1,
            partialize: (state) => ({
                filterStatus: state.filterStatus,
            }),
        },
    ),
);
