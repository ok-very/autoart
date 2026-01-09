/**
 * Projection Store
 *
 * Manages active projection preferences per surface.
 * Preferences are persisted to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectionState {
    /** Active projection ID per surface (surfaceId → projectionId) */
    activeProjections: Record<string, string>;

    /** Set active projection for a surface */
    setProjection: (surfaceId: string, projectionId: string) => void;

    /** Get active projection for a surface */
    getProjection: (surfaceId: string) => string | undefined;

    /** Clear projection for a surface (revert to default) */
    clearProjection: (surfaceId: string) => void;
}

// ============================================================================
// STORE
// ============================================================================

export const useProjectionStore = create<ProjectionState>()(
    persist(
        (set, get) => ({
            activeProjections: {},

            setProjection: (surfaceId, projectionId) =>
                set((state) => ({
                    activeProjections: {
                        ...state.activeProjections,
                        [surfaceId]: projectionId,
                    },
                })),

            getProjection: (surfaceId) => get().activeProjections[surfaceId],

            clearProjection: (surfaceId) =>
                set((state) => {
                    const { [surfaceId]: _, ...rest } = state.activeProjections;
                    return { activeProjections: rest };
                }),
        }),
        {
            name: 'autoart-projection-preferences',
            partialize: (state) => ({
                activeProjections: state.activeProjections,
            }),
        }
    )
);

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to get projection preference for a specific surface.
 */
export function useActiveProjection(
    surfaceId: string,
    defaultProjection: string = 'hierarchy-projection'
): [string, (projectionId: string) => void] {
    const { getProjection, setProjection } = useProjectionStore();

    const activeProjection = getProjection(surfaceId) ?? defaultProjection;
    const setActive = (projectionId: string) => setProjection(surfaceId, projectionId);

    return [activeProjection, setActive];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Available projection presets for UI selection */
export const AVAILABLE_PROJECTIONS = [
    {
        id: 'hierarchy-projection',
        label: 'Hierarchy',
        description: 'Tree view of project/process/subprocess/task',
    },
    {
        id: 'stage-projection',
        label: 'Stages',
        description: 'Grouped by stage labels (Kanban-like)',
    },
    {
        id: 'table-projection',
        label: 'Table',
        description: 'Spreadsheet view showing records as they will appear',
    },
    {
        id: 'log-projection',
        label: 'Log',
        description: 'Chronological event log of import actions',
    },
] as const;

/** Default projections per surface type */
export const DEFAULT_SURFACE_PROJECTIONS: Record<string, string> = {
    'import-workbench': 'hierarchy-projection',
    'workflow-surface': 'hierarchy-projection',
    'project-log': 'hierarchy-projection',
};
