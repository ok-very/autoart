/**
 * Workspace Store
 *
 * Zustand store for managing the unified Dockview workspace.
 * Single grid architecture - no separate right/bottom groups.
 *
 * Extended with workspace presets - saved panel configurations that prime
 * the UI for specific workflow stages (Intake, Plan, Act, Review, Deliver).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DockviewApi } from 'dockview';
import type { PanelId } from '../workspace/panelRegistry';
import { isPermanentPanel, PANEL_DEFINITIONS } from '../workspace/panelRegistry';
import type { WorkspacePreset, CapturedWorkspaceState, CapturedPanelState } from '../types/workspace';
import { BUILT_IN_WORKSPACES, DEFAULT_CUSTOM_WORKSPACE_ICON } from '../workspace/workspacePresets';
import { useUIStore } from './uiStore';

// Layout version - increment when layout schema changes to force reset
export const LAYOUT_VERSION = 3;

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

    // Dockview API reference for direct panel manipulation
    dockviewApi: DockviewApi | null;

    // Workspace preset state
    activeWorkspaceId: string | null;
    customWorkspaces: WorkspacePreset[];

    // Panel actions
    openPanel: (panelId: PanelId, params?: unknown) => void;
    closePanel: (panelId: PanelId) => void;
    getPanelParams: <T = unknown>(panelId: PanelId) => T | undefined;
    saveLayout: (layout: SerializedDockviewState) => void;
    setUserOverride: (panelId: PanelId, visible: boolean) => void;
    clearUserOverride: (panelId: PanelId) => void;
    resetLayout: () => void;
    setDockviewApi: (api: DockviewApi | null) => void;

    // Workspace preset actions
    applyWorkspace: (workspaceId: string) => void;
    saveCurrentAsWorkspace: (name: string) => void;
    deleteCustomWorkspace: (id: string) => void;
    captureCurrentState: () => CapturedWorkspaceState;
    getAllWorkspaces: () => WorkspacePreset[];
}

// Initial state
const initialState = {
    layout: null as SerializedDockviewState | null,
    openPanelIds: [...DEFAULT_OPEN_PANELS] as PanelId[],
    panelParams: new Map<PanelId, unknown>(),
    userOverrides: new Map<PanelId, boolean>(),
    dockviewApi: null as DockviewApi | null,
    activeWorkspaceId: null as string | null,
    customWorkspaces: [] as WorkspacePreset[],
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
                    // Already open - focus it using Dockview API
                    const api = state.dockviewApi;
                    if (api) {
                        const panel = api.getPanel(panelId);
                        if (panel) {
                            panel.api.setActive();
                        }
                    }
                    // Update params if provided
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

            setDockviewApi: (api: DockviewApi | null) => {
                set({ dockviewApi: api });
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
                    activeWorkspaceId: null,
                });
            },

            // =========================================================================
            // WORKSPACE PRESET ACTIONS
            // =========================================================================

            applyWorkspace: (workspaceId: string) => {
                const state = get();
                const allWorkspaces = [...BUILT_IN_WORKSPACES, ...state.customWorkspaces];
                const preset = allWorkspaces.find(w => w.id === workspaceId);

                if (!preset) {
                    console.warn(`Workspace not found: ${workspaceId}`);
                    return;
                }

                // Close all non-permanent panels first (except those in the preset)
                const presetPanelIds = preset.panels.map(p => p.panelId);
                const panelsToClose = state.openPanelIds.filter(
                    id => !isPermanentPanel(id) && !presetPanelIds.includes(id)
                );

                // Build new panel list: permanent panels + preset panels
                const permanentPanels = state.openPanelIds.filter(id => isPermanentPanel(id));
                const newOpenPanelIds = [...new Set([...permanentPanels, ...presetPanelIds])];

                // Apply the panel configuration
                set({
                    openPanelIds: newOpenPanelIds,
                    activeWorkspaceId: workspaceId,
                });

                // Set view modes for panels that specify them
                for (const panel of preset.panels) {
                    if (panel.viewMode) {
                        // For center-workspace, coordinate with uiStore's projectViewMode
                        if (panel.panelId === 'center-workspace') {
                            const validModes = ['workflow', 'log', 'columns', 'list', 'cards'];
                            if (validModes.includes(panel.viewMode)) {
                                useUIStore.getState().setProjectViewMode(panel.viewMode as any);
                            }
                        }
                        // Other panels can store view mode in panelParams
                        else {
                            const newParams = new Map(get().panelParams);
                            const existing = newParams.get(panel.panelId) as Record<string, unknown> | undefined;
                            newParams.set(panel.panelId, { ...existing, viewMode: panel.viewMode });
                            set({ panelParams: newParams });
                        }
                    }
                }

                // Focus the first panel in the preset using Dockview API
                const api = state.dockviewApi;
                if (api && preset.panels.length > 0) {
                    const firstPanel = api.getPanel(preset.panels[0].panelId);
                    if (firstPanel) {
                        firstPanel.api.setActive();
                    }
                }
            },

            saveCurrentAsWorkspace: (name: string) => {
                const state = get();
                const captured = state.captureCurrentState();

                const newWorkspace: WorkspacePreset = {
                    id: `custom-${Date.now()}`,
                    label: name,
                    icon: DEFAULT_CUSTOM_WORKSPACE_ICON,
                    color: 'slate',
                    scope: 'global',
                    isBuiltIn: false,
                    panels: captured.openPanels.map(p => ({
                        panelId: p.id,
                        viewMode: p.currentViewMode,
                        position: p.position,
                    })),
                };

                set({
                    customWorkspaces: [...state.customWorkspaces, newWorkspace],
                    activeWorkspaceId: newWorkspace.id,
                });
            },

            deleteCustomWorkspace: (id: string) => {
                const state = get();
                // Can only delete custom workspaces, not built-in
                const workspace = state.customWorkspaces.find(w => w.id === id);
                if (!workspace) {
                    console.warn(`Cannot delete workspace: ${id} (not found or built-in)`);
                    return;
                }

                set({
                    customWorkspaces: state.customWorkspaces.filter(w => w.id !== id),
                    // Clear active if we deleted the active workspace
                    activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
                });
            },

            captureCurrentState: (): CapturedWorkspaceState => {
                const state = get();
                const uiState = useUIStore.getState();

                const openPanels: CapturedPanelState[] = state.openPanelIds.map(id => {
                    const def = PANEL_DEFINITIONS[id];
                    const params = state.panelParams.get(id) as Record<string, unknown> | undefined;

                    // Get view mode from params or from uiStore for center-workspace
                    let currentViewMode: string | undefined;
                    if (id === 'center-workspace') {
                        currentViewMode = uiState.projectViewMode;
                    } else if (params?.viewMode) {
                        currentViewMode = params.viewMode as string;
                    }

                    return {
                        id,
                        currentViewMode,
                        position: def?.defaultPlacement.area as 'center' | 'left' | 'right' | 'bottom',
                    };
                });

                return { openPanels };
            },

            getAllWorkspaces: (): WorkspacePreset[] => {
                return [...BUILT_IN_WORKSPACES, ...get().customWorkspaces];
            },
        }),
        {
            name: 'autoart-workspace',
            partialize: (state) => ({
                layoutVersion: LAYOUT_VERSION,
                layout: state.layout,
                openPanelIds: state.openPanelIds,
                // Map needs special serialization
                userOverrides: Array.from(state.userOverrides.entries()),
                // Workspace presets
                activeWorkspaceId: state.activeWorkspaceId,
                // Custom workspaces need icon serialization (store icon name)
                customWorkspaces: state.customWorkspaces.map(w => ({
                    ...w,
                    icon: 'Folder', // Always serialize as Folder, restore at load
                })),
            }),
            merge: (persisted: unknown, current: WorkspaceState) => {
                const p = persisted as {
                    layoutVersion?: number;
                    layout?: SerializedDockviewState | null;
                    openPanelIds?: PanelId[];
                    userOverrides?: [PanelId, boolean][];
                    activeWorkspaceId?: string | null;
                    customWorkspaces?: WorkspacePreset[];
                } | undefined;

                // If layout version doesn't match, reset to defaults
                if (p?.layoutVersion !== LAYOUT_VERSION) {
                    console.log('Layout version mismatch, resetting to defaults');
                    return current;
                }

                // Restore custom workspaces with proper icon
                const customWorkspaces = (p?.customWorkspaces ?? []).map(w => ({
                    ...w,
                    icon: DEFAULT_CUSTOM_WORKSPACE_ICON,
                }));

                return {
                    ...current,
                    layout: p?.layout ?? current.layout,
                    openPanelIds: p?.openPanelIds ?? current.openPanelIds,
                    userOverrides: new Map(p?.userOverrides ?? []),
                    activeWorkspaceId: p?.activeWorkspaceId ?? current.activeWorkspaceId,
                    customWorkspaces,
                };
            },
        }
    )
);

// Selector hooks for performance
export const useOpenPanelIds = () => useWorkspaceStore((s) => s.openPanelIds);
export const useLayout = () => useWorkspaceStore((s) => s.layout);
export const useActiveWorkspaceId = () => useWorkspaceStore((s) => s.activeWorkspaceId);
export const useCustomWorkspaces = () => useWorkspaceStore((s) => s.customWorkspaces);
export const useAllWorkspaces = () => useWorkspaceStore((s) => s.getAllWorkspaces());
