/**
 * Workspace Store
 *
 * Zustand store for managing the unified Dockview workspace.
 * Single grid architecture - no separate right/bottom groups.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PanelId } from '../workspace/panelRegistry';
import { isPermanentPanel } from '../workspace/panelRegistry';

// Serialized layout state from Dockview
export interface SerializedDockviewState {
    grid: unknown;
    panels: unknown;
    activeGroup?: string;
}

// Default panels to open on fresh start
const DEFAULT_OPEN_PANELS: PanelId[] = ['center-workspace', 'selection-inspector'];

interface WorkspaceState {
    // Single layout for entire workspace
    layout: SerializedDockviewState | null;

    // Which panels are currently open (derived from layout, but tracked for persistence)
    openPanelIds: PanelId[];

    // Parameters passed to panels (e.g., recordId for inspector)
    panelParams: Map<PanelId, unknown>;

    // User-overridden visibility (manual show/hide takes precedence over context)
    userOverrides: Map<PanelId, boolean>;

    // Actions
    openPanel: (panelId: PanelId, params?: unknown) => void;
    closePanel: (panelId: PanelId) => void;
    getPanelParams: <T = unknown>(panelId: PanelId) => T | undefined;
    saveLayout: (layout: SerializedDockviewState) => void;
    setUserOverride: (panelId: PanelId, visible: boolean) => void;
    clearUserOverride: (panelId: PanelId) => void;
    resetLayout: () => void;
}

// Initial state
const initialState = {
    layout: null as SerializedDockviewState | null,
    openPanelIds: [...DEFAULT_OPEN_PANELS] as PanelId[],
    panelParams: new Map<PanelId, unknown>(),
    userOverrides: new Map<PanelId, boolean>(),
};

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set, get) => ({
            ...initialState,

            openPanel: (panelId: PanelId, params?: unknown) => {
                const state = get();
                const newParams = new Map(state.panelParams);
                if (params !== undefined) {
                    newParams.set(panelId, params);
                }
                if (state.openPanelIds.includes(panelId)) {
                    // Already open, but update params if provided
                    if (params !== undefined) {
                        set({ panelParams: newParams });
                    }
                    return;
                }
                set({
                    openPanelIds: [...state.openPanelIds, panelId],
                    panelParams: newParams,
                });
            },

            getPanelParams: <T = unknown>(panelId: PanelId): T | undefined => {
                return get().panelParams.get(panelId) as T | undefined;
            },


            closePanel: (panelId: PanelId) => {
                // Cannot close permanent panels
                if (isPermanentPanel(panelId)) {
                    console.warn(`Cannot close permanent panel: ${panelId}`);
                    return;
                }

                const state = get();
                set({
                    openPanelIds: state.openPanelIds.filter((id) => id !== panelId),
                });
            },

            saveLayout: (layout: SerializedDockviewState) => {
                set({ layout });
            },

            setUserOverride: (panelId: PanelId, visible: boolean) => {
                const state = get();
                const newOverrides = new Map(state.userOverrides);
                newOverrides.set(panelId, visible);
                set({ userOverrides: newOverrides });
            },

            clearUserOverride: (panelId: PanelId) => {
                const state = get();
                const newOverrides = new Map(state.userOverrides);
                newOverrides.delete(panelId);
                set({ userOverrides: newOverrides });
            },

            resetLayout: () => {
                // Restore default layout:
                // - Keep only permanent panels + selection-inspector
                // - Clear layout blob (DockviewWorkspace will rebuild default)
                // - Clear user overrides
                set({
                    layout: null,
                    openPanelIds: [...DEFAULT_OPEN_PANELS],
                    userOverrides: new Map(),
                });
            },
        }),
        {
            name: 'autoart-workspace',
            partialize: (state) => ({
                layout: state.layout,
                openPanelIds: state.openPanelIds,
                // Map needs special serialization
                userOverrides: Array.from(state.userOverrides.entries()),
            }),
            merge: (persisted: unknown, current: WorkspaceState) => {
                const p = persisted as { layout?: SerializedDockviewState | null; openPanelIds?: PanelId[]; userOverrides?: [PanelId, boolean][] } | undefined;
                return {
                    ...current,
                    layout: p?.layout ?? current.layout,
                    openPanelIds: p?.openPanelIds ?? current.openPanelIds,
                    userOverrides: new Map(p?.userOverrides ?? []),
                };
            },
        }
    )
);

// Selector hooks for performance
export const useOpenPanelIds = () => useWorkspaceStore((s) => s.openPanelIds);
export const useLayout = () => useWorkspaceStore((s) => s.layout);
