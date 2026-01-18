/**
 * Workspace Store
 *
 * Zustand store for managing Dockview panel state.
 * Handles right sidebar and bottom panel visibility and layout persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { PanelId, RightPanelId, BottomPanelId } from '../workspace/panelRegistry';

// Serialized layout state from Dockview
export interface SerializedDockviewState {
    grid: unknown;
    panels: unknown;
    activeGroup?: string;
}

interface WorkspaceState {
    // Right panel group state
    rightPanelVisible: boolean;
    rightPanelIds: RightPanelId[];
    rightActivePanel: RightPanelId | null;
    rightPanelLayout: SerializedDockviewState | null;

    // Bottom panel group state
    bottomPanelVisible: boolean;
    bottomPanelIds: BottomPanelId[];
    bottomActivePanel: BottomPanelId | null;
    bottomPanelLayout: SerializedDockviewState | null;

    // Bottom panel height (persisted)
    bottomPanelHeight: number;

    // Actions
    openPanel: (panelId: PanelId) => void;
    closePanel: (panelId: PanelId) => void;
    setActivePanel: (area: 'right' | 'bottom', panelId: PanelId | null) => void;
    togglePanelGroup: (area: 'right' | 'bottom') => void;
    setBottomPanelHeight: (height: number) => void;
    saveLayout: (area: 'right' | 'bottom', layout: SerializedDockviewState) => void;
    resetLayout: () => void;
}

// Initial state
const initialState = {
    rightPanelVisible: false,
    rightPanelIds: [] as RightPanelId[],
    rightActivePanel: null as RightPanelId | null,
    rightPanelLayout: null,

    bottomPanelVisible: false,
    bottomPanelIds: [] as BottomPanelId[],
    bottomActivePanel: null as BottomPanelId | null,
    bottomPanelLayout: null,

    bottomPanelHeight: 300,
};

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set, get) => ({
            ...initialState,

            openPanel: (panelId: PanelId) => {
                const state = get();

                // Determine which area this panel belongs to
                const isRightPanel = panelId === 'selection-inspector' || panelId === 'record-properties';

                if (isRightPanel) {
                    const rightId = panelId as RightPanelId;
                    const alreadyOpen = state.rightPanelIds.includes(rightId);

                    set({
                        rightPanelVisible: true,
                        rightPanelIds: alreadyOpen
                            ? state.rightPanelIds
                            : [...state.rightPanelIds, rightId],
                        rightActivePanel: rightId,
                    });
                } else {
                    const bottomId = panelId as BottomPanelId;
                    const alreadyOpen = state.bottomPanelIds.includes(bottomId);

                    set({
                        bottomPanelVisible: true,
                        bottomPanelIds: alreadyOpen
                            ? state.bottomPanelIds
                            : [...state.bottomPanelIds, bottomId],
                        bottomActivePanel: bottomId,
                    });
                }
            },

            closePanel: (panelId: PanelId) => {
                const state = get();

                const isRightPanel = panelId === 'selection-inspector' || panelId === 'record-properties';

                if (isRightPanel) {
                    const rightId = panelId as RightPanelId;
                    const newIds = state.rightPanelIds.filter((id) => id !== rightId);
                    const newActive =
                        state.rightActivePanel === rightId
                            ? newIds[0] ?? null
                            : state.rightActivePanel;

                    set({
                        rightPanelIds: newIds,
                        rightActivePanel: newActive,
                        rightPanelVisible: newIds.length > 0,
                    });
                } else {
                    const bottomId = panelId as BottomPanelId;
                    const newIds = state.bottomPanelIds.filter((id) => id !== bottomId);
                    const newActive =
                        state.bottomActivePanel === bottomId
                            ? newIds[0] ?? null
                            : state.bottomActivePanel;

                    set({
                        bottomPanelIds: newIds,
                        bottomActivePanel: newActive,
                        bottomPanelVisible: newIds.length > 0,
                    });
                }
            },

            setActivePanel: (area, panelId) => {
                if (area === 'right') {
                    set({ rightActivePanel: panelId as RightPanelId | null });
                } else {
                    set({ bottomActivePanel: panelId as BottomPanelId | null });
                }
            },

            togglePanelGroup: (area) => {
                if (area === 'right') {
                    set((state) => ({ rightPanelVisible: !state.rightPanelVisible }));
                } else {
                    set((state) => ({ bottomPanelVisible: !state.bottomPanelVisible }));
                }
            },

            setBottomPanelHeight: (height) => {
                set({ bottomPanelHeight: Math.max(100, Math.min(600, height)) });
            },

            saveLayout: (area, layout) => {
                if (area === 'right') {
                    set({ rightPanelLayout: layout });
                } else {
                    set({ bottomPanelLayout: layout });
                }
            },

            resetLayout: () => {
                set(initialState);
            },
        }),
        {
            name: 'autoart-workspace',
            partialize: (state) => ({
                rightPanelIds: state.rightPanelIds,
                rightActivePanel: state.rightActivePanel,
                rightPanelVisible: state.rightPanelVisible,
                bottomPanelIds: state.bottomPanelIds,
                bottomActivePanel: state.bottomActivePanel,
                bottomPanelVisible: state.bottomPanelVisible,
                bottomPanelHeight: state.bottomPanelHeight,
            }),
        }
    )
);
