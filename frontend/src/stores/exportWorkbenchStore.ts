/**
 * Export Workbench Store
 *
 * Zustand store for Export Workbench state.
 * Manages project selection, format, options, and preview state.
 */

import { create } from 'zustand';

import { DEFAULT_EXPORT_OPTIONS } from '@autoart/shared';

import type { ExportFormat, ExportOptions } from '../surfaces/export/types';

interface ExportWorkbenchState {
    // Selection state
    selectedProjectIds: Set<string>;
    previewProjectId: string | null;

    // Export configuration
    format: ExportFormat;
    options: ExportOptions;

    // Actions
    toggleProject: (id: string) => void;
    selectAll: (ids: string[]) => void;
    selectNone: () => void;
    setPreviewProject: (id: string | null) => void;
    setFormat: (format: ExportFormat) => void;
    setOption: <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => void;
    reset: () => void;
}

export const useExportWorkbenchStore = create<ExportWorkbenchState>((set) => ({
    // Initial state
    selectedProjectIds: new Set(),
    previewProjectId: null,
    format: 'rtf',
    options: DEFAULT_EXPORT_OPTIONS,

    // Actions
    toggleProject: (id) =>
        set((state) => {
            const next = new Set(state.selectedProjectIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { selectedProjectIds: next };
        }),

    selectAll: (ids) => set({ selectedProjectIds: new Set(ids) }),

    selectNone: () => set({ selectedProjectIds: new Set() }),

    setPreviewProject: (previewProjectId) => set({ previewProjectId }),

    setFormat: (format) => set({ format }),

    setOption: (key, value) =>
        set((state) => ({
            options: { ...state.options, [key]: value },
        })),

    reset: () =>
        set({
            selectedProjectIds: new Set(),
            previewProjectId: null,
            format: 'rtf',
            options: DEFAULT_EXPORT_OPTIONS,
        }),
}));
