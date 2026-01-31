/**
 * Export Workbench Store
 *
 * Zustand store for Export Workbench state.
 * Manages project selection, format, options, preview, and step flow.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_EXPORT_OPTIONS } from '@autoart/shared';

import type { ExportFormat, ExportOptions } from '../workflows/export/types';

type ExportStep = 'configure' | 'output';

interface ExportWorkbenchState {
    // Selection state
    selectedProjectIds: Set<string>;
    previewProjectId: string | null;

    // Export configuration
    format: ExportFormat;
    options: ExportOptions;

    // Step flow
    step: ExportStep;
    activeSessionId: string | null;

    // Actions
    toggleProject: (id: string) => void;
    selectAll: (ids: string[]) => void;
    selectNone: () => void;
    setPreviewProject: (id: string | null) => void;
    setFormat: (format: ExportFormat) => void;
    setOption: <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => void;
    setStep: (step: ExportStep) => void;
    setActiveSession: (sessionId: string | null) => void;
    reset: () => void;
}

export const useExportWorkbenchStore = create<ExportWorkbenchState>()(
    persist(
        (set) => ({
            // Initial state
            selectedProjectIds: new Set(),
            previewProjectId: null,
            format: 'rtf',
            options: DEFAULT_EXPORT_OPTIONS,
            step: 'configure',
            activeSessionId: null,

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

            setStep: (step) => set({ step }),

            setActiveSession: (activeSessionId) => set({ activeSessionId }),

            reset: () =>
                set({
                    selectedProjectIds: new Set(),
                    previewProjectId: null,
                    format: 'rtf',
                    options: DEFAULT_EXPORT_OPTIONS,
                    step: 'configure',
                    activeSessionId: null,
                }),
        }),
        {
            name: 'export-workbench-storage',
            version: 2,
            partialize: (state) => ({
                format: state.format,
                options: state.options,
                step: state.step,
                activeSessionId: state.activeSessionId,
            }),
        },
    ),
);
