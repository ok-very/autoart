/**
 * Context Store
 *
 * Zustand store for managing global application context.
 * Panels subscribe to context changes to determine visibility and actions.
 */

import { create } from 'zustand';
import {
    type AppContext,
    type SelectionContext,
    type ImportSessionContext,
    type SearchContext,
    DEFAULT_CONTEXT,
    PANEL_DEFINITIONS,
    type PanelId,
} from '../workspace/panelRegistry';

interface ContextState {
    // Current app context
    context: AppContext;

    // Actions
    updateSelection: (selection: SelectionContext) => void;
    setImportSession: (session: ImportSessionContext) => void;
    setSearchContext: (search: SearchContext) => void;
    clearSelection: () => void;
    clearImportSession: () => void;
    clearSearch: () => void;

    // Derived state (computed from context + panel registry)
    getVisiblePanels: () => PanelId[];
    getActionablePanels: () => PanelId[];
}

export const useContextStore = create<ContextState>()((set, get) => ({
    context: DEFAULT_CONTEXT,

    updateSelection: (selection: SelectionContext) => {
        set((state) => ({
            context: { ...state.context, selection },
        }));
    },

    setImportSession: (session: ImportSessionContext) => {
        set((state) => ({
            context: { ...state.context, importSession: session },
        }));
    },

    setSearchContext: (search: SearchContext) => {
        set((state) => ({
            context: { ...state.context, search },
        }));
    },

    clearSelection: () => {
        set((state) => ({
            context: {
                ...state.context,
                selection: DEFAULT_CONTEXT.selection,
            },
        }));
    },

    clearImportSession: () => {
        set((state) => ({
            context: {
                ...state.context,
                importSession: DEFAULT_CONTEXT.importSession,
            },
        }));
    },

    clearSearch: () => {
        set((state) => ({
            context: {
                ...state.context,
                search: DEFAULT_CONTEXT.search,
            },
        }));
    },

    getVisiblePanels: () => {
        const ctx = get().context;
        return Object.values(PANEL_DEFINITIONS)
            .filter((p) => p.shouldShow(ctx))
            .map((p) => p.id);
    },

    getActionablePanels: () => {
        const ctx = get().context;
        return Object.values(PANEL_DEFINITIONS)
            .filter((p) => p.canActOn(ctx))
            .map((p) => p.id);
    },
}));

// Selector hooks for reactivity
export const useAppContext = () => useContextStore((s) => s.context);
export const useSelection = () => useContextStore((s) => s.context.selection);
export const useImportSession = () => useContextStore((s) => s.context.importSession);
export const useSearchContext = () => useContextStore((s) => s.context.search);

/**
 * Hook to get panels that should be visible based on current context
 * Re-renders when context changes
 */
export function useVisiblePanels(): PanelId[] {
    const context = useContextStore((s) => s.context);
    return Object.values(PANEL_DEFINITIONS)
        .filter((p) => p.shouldShow(context))
        .map((p) => p.id);
}

/**
 * Hook to check if a specific panel should be visible
 */
export function useShouldShowPanel(panelId: PanelId): boolean {
    const context = useContextStore((s) => s.context);
    const definition = PANEL_DEFINITIONS[panelId];
    return definition?.shouldShow(context) ?? false;
}

/**
 * Hook to check if a specific panel can act on current context
 */
export function useCanPanelAct(panelId: PanelId): boolean {
    const context = useContextStore((s) => s.context);
    const definition = PANEL_DEFINITIONS[panelId];
    return definition?.canActOn(context) ?? false;
}
