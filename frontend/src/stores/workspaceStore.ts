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
import type { WorkspacePreset, WorkspacePanelConfig, CapturedWorkspaceState, CapturedPanelState, PersistedWorkspacePreset } from '../types/workspace';
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

/**
 * Panel position hint for workspace presets.
 * Note: 'left' is normalized to 'right' at runtime since Dockview doesn't support left splits.
 */
type PanelPosition = 'center' | 'left' | 'right' | 'bottom';

/**
 * Resolve which panels to use for a workspace preset.
 * Prefers subviews if available, falls back to legacy `panels` field.
 * Returns the matching subview ID (or null) and the panels array.
 */
function resolveSubviewPanels(
    preset: WorkspacePreset,
    subviewId?: string,
): { resolvedSubviewId: string | null; panels: WorkspacePanelConfig[] } {
    if (preset.subviews && preset.subviews.length > 0) {
        const match = subviewId
            ? preset.subviews.find(s => s.id === subviewId)
            : preset.subviews[0];
        const resolved = match ?? preset.subviews[0];
        return { resolvedSubviewId: resolved.id, panels: resolved.panels };
    }
    // Legacy: custom workspaces without subviews
    return { resolvedSubviewId: null, panels: preset.panels };
}

interface WorkspaceState {
    // Single layout for entire workspace
    layout: SerializedDockviewState | null;

    // Which panels are currently open (derived from layout, but tracked for persistence)
    openPanelIds: PanelId[];

    // Parameters passed to panels (e.g., recordId for inspector)
    panelParams: Map<string, unknown>;

    // User-overridden visibility (manual show/hide takes precedence over context)
    userOverrides: Map<PanelId, boolean>;

    // Dockview API reference for direct panel manipulation
    dockviewApi: DockviewApi | null;

    // Workspace preset state
    activeWorkspaceId: string | null;
    activeSubviewId: string | null;
    customWorkspaces: WorkspacePreset[];

    // Pending panel positions from workspace presets (consumed by MainLayout)
    pendingPanelPositions: Map<PanelId, PanelPosition>;

    // Bound project state (for multi-project panels)
    boundProjectId: string | null;          // Workspace's active project
    boundPanelIds: Set<string>;             // Panel IDs bound to workspace project
    workspaceModified: boolean;             // True when user modifies panels

    // Panel actions
    openPanel: (panelId: PanelId, params?: unknown) => void;
    closePanel: (panelId: PanelId) => void;
    getPanelParams: <T = unknown>(panelId: string) => T | undefined;
    setPanelParam: (panelId: string, params: unknown) => void;
    saveLayout: (layout: SerializedDockviewState) => void;
    setUserOverride: (panelId: PanelId, visible: boolean) => void;
    clearUserOverride: (panelId: PanelId) => void;
    resetLayout: () => void;
    setDockviewApi: (api: DockviewApi | null) => void;
    clearPendingPositions: (panelIds?: PanelId[]) => void;

    // Bound project actions
    setBoundProject: (projectId: string | null) => void;
    bindPanelToWorkspace: (panelId: string) => void;
    unbindPanel: (panelId: string) => void;
    markWorkspaceModified: () => void;

    // Workspace preset actions
    applyWorkspace: (workspaceId: string, subviewId?: string) => void;
    saveCurrentAsWorkspace: (name: string) => void;
    deleteCustomWorkspace: (id: string) => void;
    captureCurrentState: () => CapturedWorkspaceState;
    getAllWorkspaces: () => WorkspacePreset[];
}

// Initial state
const initialState = {
    layout: null as SerializedDockviewState | null,
    openPanelIds: [...DEFAULT_OPEN_PANELS] as PanelId[],
    panelParams: new Map<string, unknown>(),
    userOverrides: new Map<PanelId, boolean>(),
    dockviewApi: null as DockviewApi | null,
    activeWorkspaceId: null as string | null,
    activeSubviewId: null as string | null,
    customWorkspaces: [] as WorkspacePreset[],
    pendingPanelPositions: new Map<PanelId, PanelPosition>(),
    boundProjectId: null as string | null,
    boundPanelIds: new Set<string>(),
    workspaceModified: false,
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

            getPanelParams: <T = unknown>(panelId: string): T | undefined => {
                return get().panelParams.get(panelId) as T | undefined;
            },

            setPanelParam: (panelId: string, params: unknown) => {
                const state = get();
                const newParams = new Map(state.panelParams);
                newParams.set(panelId, params);
                set({ panelParams: newParams });
            },


            closePanel: (panelId: PanelId) => {
                // Cannot close permanent panels
                if (isPermanentPanel(panelId)) {
                    console.warn(`Cannot close permanent panel: ${panelId}`);
                    return;
                }

                const state = get();

                // Close via Dockview API first
                const api = state.dockviewApi;
                if (api) {
                    const panel = api.getPanel(panelId);
                    if (panel) {
                        panel.api.close();
                    }
                }

                // Then update state
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
                    activeSubviewId: null,
                    boundProjectId: null,
                    boundPanelIds: new Set(),
                    workspaceModified: false,
                });
            },

            // =========================================================================
            // BOUND PROJECT ACTIONS
            // =========================================================================

            setBoundProject: (projectId: string | null) => {
                set({ boundProjectId: projectId });
            },

            bindPanelToWorkspace: (panelId: string) => {
                const state = get();
                const newBoundPanelIds = new Set(state.boundPanelIds);
                newBoundPanelIds.add(panelId);
                set({ boundPanelIds: newBoundPanelIds });
            },

            unbindPanel: (panelId: string) => {
                const state = get();
                const newBoundPanelIds = new Set(state.boundPanelIds);
                newBoundPanelIds.delete(panelId);
                set({ boundPanelIds: newBoundPanelIds });
            },

            markWorkspaceModified: () => {
                set({ workspaceModified: true });
            },

            // =========================================================================
            // WORKSPACE PRESET ACTIONS
            // =========================================================================

            applyWorkspace: (workspaceId: string, subviewId?: string) => {
                const state = get();
                const allWorkspaces = [...BUILT_IN_WORKSPACES, ...state.customWorkspaces];
                const preset = allWorkspaces.find(w => w.id === workspaceId);

                if (!preset) {
                    console.warn(`Workspace not found: ${workspaceId}`);
                    return;
                }

                const { resolvedSubviewId, panels: resolvedPanels } = resolveSubviewPanels(preset, subviewId);
                const api = state.dockviewApi;

                // Close ALL non-permanent panels (we'll rebuild with unique IDs)
                if (api) {
                    for (const panelId of state.openPanelIds) {
                        if (!isPermanentPanel(panelId)) {
                            const panel = api.getPanel(panelId);
                            if (panel) {
                                panel.api.close();
                            }
                        }
                    }
                    // Also close any dynamically created panels (project-panel-*)
                    api.panels.forEach((panel) => {
                        const panelId = panel.id;
                        if (panelId.startsWith('project-panel-') || (!isPermanentPanel(panelId as PanelId) && !state.openPanelIds.includes(panelId as PanelId))) {
                            panel.api.close();
                        }
                    });
                }

                // Build new panel list with unique IDs for project-panel
                const permanentPanels = state.openPanelIds.filter(id => isPermanentPanel(id));
                const newOpenPanelIds: string[] = [...permanentPanels];
                const newBoundPanelIds = new Set<string>();
                const positionMap = new Map<string, PanelPosition>();
                const newParams = new Map<string, unknown>(state.panelParams);
                let projectPanelCounter = 0;

                for (const panelConfig of resolvedPanels) {
                    const baseId = panelConfig.panelId;

                    // Generate unique ID for project-panel, keep original ID for others
                    let uniqueId: string;
                    if (baseId === 'project-panel') {
                        uniqueId = `project-panel-${Date.now()}-${projectPanelCounter++}`;
                    } else {
                        uniqueId = baseId;
                    }

                    // Track bound panels
                    if (panelConfig.bound) {
                        newBoundPanelIds.add(uniqueId);
                    }

                    // Add to open panels list
                    if (!newOpenPanelIds.includes(uniqueId)) {
                        newOpenPanelIds.push(uniqueId as PanelId);
                    }

                    // Set position hint
                    if (panelConfig.position && panelConfig.position !== 'center') {
                        positionMap.set(uniqueId as PanelId, panelConfig.position);
                    }

                    // Set content type for center-workspace
                    if (baseId === 'center-workspace' && panelConfig.contentType) {
                        useUIStore.getState().setCenterContentType(panelConfig.contentType);
                    }

                    // Set view mode
                    if (panelConfig.viewMode) {
                        if (baseId === 'center-workspace') {
                            const validModes = ['workflow', 'log', 'columns', 'list', 'cards'];
                            if (validModes.includes(panelConfig.viewMode)) {
                                useUIStore.getState().setProjectViewMode(panelConfig.viewMode as any);
                            }
                        } else {
                            const existing = newParams.get(uniqueId) as Record<string, unknown> | undefined;
                            newParams.set(uniqueId, { ...existing, viewMode: panelConfig.viewMode });
                        }
                    }
                }

                // Apply the panel configuration
                set({
                    openPanelIds: newOpenPanelIds as PanelId[],
                    activeWorkspaceId: workspaceId,
                    activeSubviewId: resolvedSubviewId,
                    pendingPanelPositions: positionMap as Map<PanelId, PanelPosition>,
                    boundPanelIds: newBoundPanelIds,
                    workspaceModified: false,
                    panelParams: newParams,
                });

                // Focus the first panel in the preset using Dockview API
                if (api && resolvedPanels.length > 0) {
                    // For project-panel, we need to find by generated ID
                    const firstPanelConfig = resolvedPanels[0];
                    const firstPanelId = firstPanelConfig.panelId === 'project-panel'
                        ? Array.from(newBoundPanelIds)[0] || firstPanelConfig.panelId
                        : firstPanelConfig.panelId;
                    const firstPanel = api.getPanel(firstPanelId);
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
                // Maps and Sets need special serialization
                userOverrides: Array.from(state.userOverrides.entries()),
                panelParams: Array.from(state.panelParams.entries()),
                // Workspace presets
                activeWorkspaceId: state.activeWorkspaceId,
                activeSubviewId: state.activeSubviewId,
                // Custom workspaces: omit icon (React component functions cannot be JSON serialized), reattach on load
                customWorkspaces: state.customWorkspaces.map(({ icon: _, ...w }) => w),
                // Bound project state
                boundProjectId: state.boundProjectId,
                boundPanelIds: Array.from(state.boundPanelIds),
                workspaceModified: state.workspaceModified,
            }),
            merge: (persisted: unknown, current: WorkspaceState) => {
                const p = persisted as {
                    layoutVersion?: number;
                    layout?: SerializedDockviewState | null;
                    openPanelIds?: PanelId[];
                    userOverrides?: [PanelId, boolean][];
                    panelParams?: [string, unknown][];
                    activeWorkspaceId?: string | null;
                    activeSubviewId?: string | null;
                    customWorkspaces?: PersistedWorkspacePreset[];
                    boundProjectId?: string | null;
                    boundPanelIds?: string[];
                    workspaceModified?: boolean;
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
                    activeSubviewId: p?.activeSubviewId ?? current.activeSubviewId,
                    customWorkspaces,
                    boundProjectId: p?.boundProjectId ?? current.boundProjectId,
                    boundPanelIds: new Set(p?.boundPanelIds ?? []),
                    workspaceModified: p?.workspaceModified ?? current.workspaceModified,
                };
            },
        }
    )
);

// Selector hooks for performance
export const useOpenPanelIds = () => useWorkspaceStore((s) => s.openPanelIds);
export const useLayout = () => useWorkspaceStore((s) => s.layout);
export const useActiveWorkspaceId = () => useWorkspaceStore((s) => s.activeWorkspaceId);
export const useActiveSubviewId = () => useWorkspaceStore((s) => s.activeSubviewId);
export const useCustomWorkspaces = () => useWorkspaceStore((s) => s.customWorkspaces);
export const useAllWorkspaces = () => useWorkspaceStore((s) => s.getAllWorkspaces());
export const usePendingPanelPositions = () => useWorkspaceStore((s) => s.pendingPanelPositions);
export const useBoundProjectId = () => useWorkspaceStore((s) => s.boundProjectId);
export const useBoundPanelIds = () => useWorkspaceStore((s) => s.boundPanelIds);
