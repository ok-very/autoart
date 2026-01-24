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
import type { WorkspacePreset, CapturedWorkspaceState, CapturedPanelState, PersistedWorkspacePreset } from '../types/workspace';
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

type PanelPosition = 'center' | 'left' | 'right' | 'bottom';

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

    // Pending panel positions from workspace presets (consumed by MainLayout)
    pendingPanelPositions: Map<PanelId, PanelPosition>;

    // Panel actions
    openPanel: (panelId: PanelId, params?: unknown) => void;
    closePanel: (panelId: PanelId) => void;
    getPanelParams: <T = unknown>(panelId: PanelId) => T | undefined;
    saveLayout: (layout: SerializedDockviewState) => void;
    setUserOverride: (panelId: PanelId, visible: boolean) => void;
    clearUserOverride: (panelId: PanelId) => void;
    resetLayout: () => void;
    setDockviewApi: (api: DockviewApi | null) => void;
    clearPendingPositions: (panelIds?: PanelId[]) => void;

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
    pendingPanelPositions: new Map<PanelId, PanelPosition>(),
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

            clearPendingPositions: (panelIds?: PanelId[]) => {
                if (!panelIds) {
                    set({ pendingPanelPositions: new Map() });
                    return;
                }
                const current = get().pendingPanelPositions;
                const updated = new Map(current);
                for (const id of panelIds) {
                    updated.delete(id);
                }
                set({ pendingPanelPositions: updated });
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
                // - Reset to DEFAULT_OPEN_PANELS (center-workspace + selection-inspector)
                // - Clear layout blob (DockviewWorkspace will rebuild default)
                // - Clear user overrides and active workspace
                set({
                    layout: null,
                    openPanelIds: [...DEFAULT_OPEN_PANELS],
                    panelParams: new Map(),
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

                const presetPanelIds = preset.panels.map(p => p.panelId);

                // Close panels not in preset via Dockview API
                const panelsToClose = state.openPanelIds.filter(
                    id => !isPermanentPanel(id) && !presetPanelIds.includes(id)
                );
                const api = state.dockviewApi;
                if (api) {
                    for (const panelId of panelsToClose) {
                        const panel = api.getPanel(panelId);
                        if (panel) {
                            panel.api.close();
                        }
                    }
                }

                // Build new panel list: permanent panels + preset panels
                const permanentPanels = state.openPanelIds.filter(id => isPermanentPanel(id));
                const newOpenPanelIds = [...new Set([...permanentPanels, ...presetPanelIds])];

                // Build position hints for panels (non-center positions)
                const positionMap = new Map<PanelId, PanelPosition>();
                for (const panel of preset.panels) {
                    if (panel.position && panel.position !== 'center') {
                        positionMap.set(panel.panelId, panel.position);
                    }
                }

                // Apply the panel configuration with position hints
                set({
                    openPanelIds: newOpenPanelIds,
                    activeWorkspaceId: workspaceId,
                    pendingPanelPositions: positionMap,
                });

                // Set view modes for panels that specify them (batched to avoid race conditions)
                const newParams = new Map(get().panelParams);
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
                            const existing = newParams.get(panel.panelId) as Record<string, unknown> | undefined;
                            newParams.set(panel.panelId, { ...existing, viewMode: panel.viewMode });
                        }
                    }
                }
                set({ panelParams: newParams });

                // Focus the first panel in the preset using Dockview API
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

                // Use timestamp + random suffix to prevent collision within same millisecond
                const uniqueId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const newWorkspace: WorkspacePreset = {
                    id: uniqueId,
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
                const validPositions = ['center', 'left', 'right', 'bottom'] as const;

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

                    // Validate position value - only use if it's a valid position
                    const rawPosition = def?.defaultPlacement?.area;
                    const position = validPositions.includes(rawPosition as typeof validPositions[number])
                        ? (rawPosition as 'center' | 'left' | 'right' | 'bottom')
                        : undefined;

                    return {
                        id,
                        currentViewMode,
                        position,
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
                // Maps need special serialization
                userOverrides: Array.from(state.userOverrides.entries()),
                panelParams: Array.from(state.panelParams.entries()),
                // Workspace presets
                activeWorkspaceId: state.activeWorkspaceId,
                // Custom workspaces: omit icon (React component functions cannot be JSON serialized), reattach on load
                customWorkspaces: state.customWorkspaces.map(({ icon: _, ...w }) => w),
            }),
            merge: (persisted: unknown, current: WorkspaceState) => {
                const p = persisted as {
                    layoutVersion?: number;
                    layout?: SerializedDockviewState | null;
                    openPanelIds?: PanelId[];
                    userOverrides?: [PanelId, boolean][];
                    panelParams?: [PanelId, unknown][];
                    activeWorkspaceId?: string | null;
                    customWorkspaces?: PersistedWorkspacePreset[];
                } | undefined;

                // Handle version mismatch: preserve custom workspaces but reset layout
                // Layout schema changes require resetting panel arrangement to prevent corruption
                if (p?.layoutVersion !== LAYOUT_VERSION) {
                    console.warn(
                        `[WorkspaceStore] Layout version changed (${p?.layoutVersion ?? 'none'} -> ${LAYOUT_VERSION}). ` +
                        'Resetting panel layout to defaults. Custom workspaces preserved.'
                    );
                    // Preserve custom workspaces from old version
                    const customWorkspaces = (p?.customWorkspaces ?? []).map(w => ({
                        ...w,
                        icon: DEFAULT_CUSTOM_WORKSPACE_ICON,
                    }));
                    return {
                        ...current,
                        customWorkspaces,
                    };
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
                    panelParams: new Map(p?.panelParams ?? []),
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
export const usePendingPanelPositions = () => useWorkspaceStore((s) => s.pendingPanelPositions);
