/**
 * Export Workbench Store
 *
 * Zustand store for Export Workbench state.
 * Manages format, section configuration, and session flow.
 *
 * Project selection is handled by the Collection System (collectionStore).
 * This store handles export-specific configuration that sits alongside it.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_EXPORT_OPTIONS, SECTION_DEFINITIONS } from '@autoart/shared';

import type { ExportFormat, ExportOptions } from '../workflows/export/types';

type ExportStep = 'configure' | 'output';

/** Build initial section config from SECTION_DEFINITIONS defaults */
function buildDefaultSectionConfig(): Record<string, boolean> {
    const config: Record<string, boolean> = {};
    for (const def of SECTION_DEFINITIONS) {
        config[def.id] = def.defaultEnabled;
    }
    return config;
}

interface ExportWorkbenchState {
    // Export configuration
    format: ExportFormat;
    options: ExportOptions;

    // Section toggles (keyed by ExportOptions field name)
    sectionConfig: Record<string, boolean>;

    // Step flow
    step: ExportStep;
    activeSessionId: string | null;

    // Context helper state
    stalenessThresholdDays: number;
    linkedDocId: string | null;

    // Actions
    setFormat: (format: ExportFormat) => void;
    setOption: <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => void;
    setSectionConfig: (config: Record<string, boolean>) => void;
    toggleSection: (sectionId: string) => void;
    setStep: (step: ExportStep) => void;
    setActiveSession: (sessionId: string | null) => void;
    setStalenessThreshold: (days: number) => void;
    setLinkedDocId: (docId: string | null) => void;
    reset: () => void;

    /** Build ExportOptions by merging section toggles into base options */
    getMergedOptions: () => ExportOptions;
}

export const useExportWorkbenchStore = create<ExportWorkbenchState>()(
    persist(
        (set, get) => ({
            // Initial state
            format: 'rtf',
            options: DEFAULT_EXPORT_OPTIONS,
            sectionConfig: buildDefaultSectionConfig(),
            step: 'configure',
            activeSessionId: null,
            stalenessThresholdDays: 7,
            linkedDocId: null,

            // Actions
            setFormat: (format) => set({ format }),

            setOption: (key, value) =>
                set((state) => ({
                    options: { ...state.options, [key]: value },
                })),

            setSectionConfig: (config) => set({ sectionConfig: config }),

            toggleSection: (sectionId) =>
                set((state) => ({
                    sectionConfig: {
                        ...state.sectionConfig,
                        [sectionId]: !state.sectionConfig[sectionId],
                    },
                })),

            setStep: (step) => set({ step }),

            setActiveSession: (activeSessionId) => set({ activeSessionId }),

            setStalenessThreshold: (days) => set({ stalenessThresholdDays: days }),

            setLinkedDocId: (docId) => set({ linkedDocId: docId }),

            reset: () =>
                set({
                    format: 'rtf',
                    options: DEFAULT_EXPORT_OPTIONS,
                    sectionConfig: buildDefaultSectionConfig(),
                    step: 'configure',
                    activeSessionId: null,
                    stalenessThresholdDays: 7,
                    linkedDocId: null,
                }),

            getMergedOptions: () => {
                const state = get();
                const merged = { ...state.options };
                for (const [key, enabled] of Object.entries(state.sectionConfig)) {
                    if (key in merged) {
                        (merged as Record<string, unknown>)[key] = enabled;
                    }
                }
                return merged;
            },
        }),
        {
            name: 'export-workbench-storage',
            version: 4,
            partialize: (state) => ({
                format: state.format,
                options: state.options,
                sectionConfig: state.sectionConfig,
                step: state.step,
                activeSessionId: state.activeSessionId,
                stalenessThresholdDays: state.stalenessThresholdDays,
                linkedDocId: state.linkedDocId,
            }),
        },
    ),
);
