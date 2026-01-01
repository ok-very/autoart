import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Selection, UIPanels, InspectorMode, DrawerConfig } from '../types/ui';
import { deriveUIPanels } from '../utils/uiComposition';

// Re-export for compatibility if needed, or prefer importing from types/ui
export type { Selection, UIPanels, InspectorMode };

type ViewMode = 'workflow' | 'grid' | 'calendar' | 'columns';
type Theme = 'light' | 'dark';

interface UIState {
  // Core State
  selection: Selection;
  activeProjectId: string | null;
  viewMode: ViewMode;
  inspectorTabMode: string; // 'record', 'schema', 'references', etc.

  // Layout Geometry
  sidebarWidth: number;
  inspectorWidth: number;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  drawerHeight: number;

  // Drawer State
  activeDrawer: DrawerConfig | null;

  // Theme
  theme: Theme;

  // Actions
  setSelection: (selection: Selection) => void;
  setActiveProject: (id: string | null) => void;
  setInspectorTab: (tab: string) => void;

  toggleSidebar: () => void;
  toggleInspector: () => void;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;

  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: Theme) => void;

  // Drawer Actions
  openDrawer: (type: string, props?: Record<string, unknown>) => void;
  closeDrawer: () => void;
  setDrawerHeight: (height: number) => void;

  // Legacy compatibility - derived from selection
  readonly inspectedNodeId: string | null;
  readonly inspectedRecordId: string | null;
  readonly inspectorMode: string;
  setInspectorMode: (mode: string) => void;
  inspectRecord: (recordId: string) => void;
  inspectNode: (nodeId: string) => void;
  clearInspection: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      selection: null,
      activeProjectId: null,
      viewMode: 'workflow',
      inspectorTabMode: 'record',

      sidebarWidth: 280,
      inspectorWidth: 380,
      sidebarCollapsed: false,
      inspectorCollapsed: false,
      drawerHeight: 300,

      activeDrawer: null,
      theme: 'light',

      setSelection: (selection) => set({ selection }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      setInspectorTab: (tab) => set({ inspectorTabMode: tab }),

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleInspector: () => set((state) => ({ inspectorCollapsed: !state.inspectorCollapsed })),
      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),
      setInspectorWidth: (width) => set({ inspectorWidth: Math.max(300, Math.min(500, width)) }),

      setViewMode: (mode) => set((state) => {
        // Clear selection when switching to views that may not support current selection
        const shouldClearSelection =
          mode === 'calendar' || // Calendar shows tasks with due dates only
          (mode === 'columns' && state.viewMode !== 'columns'); // Miller columns has its own navigation

        return {
          viewMode: mode,
          ...(shouldClearSelection ? { selection: null } : {}),
        };
      }),
      setTheme: (theme) => set({ theme }),

      openDrawer: (type, props = {}) => set({ activeDrawer: { type, props } }),
      closeDrawer: () => set({ activeDrawer: null }),
      setDrawerHeight: (height) => set({ drawerHeight: Math.max(100, Math.min(600, height)) }),

      // Legacy compatibility getters - derived from selection
      get inspectedNodeId() {
        const sel = get().selection;
        return sel?.type === 'node' ? sel.id : null;
      },
      get inspectedRecordId() {
        const sel = get().selection;
        return sel?.type === 'record' ? sel.id : null;
      },
      get inspectorMode() {
        return get().inspectorTabMode;
      },
      setInspectorMode: (mode) => set({ inspectorTabMode: mode }),
      inspectRecord: (recordId) => set({ selection: { type: 'record', id: recordId }, inspectorCollapsed: false }),
      inspectNode: (nodeId) => set({ selection: { type: 'node', id: nodeId }, inspectorCollapsed: false }),
      clearInspection: () => set({ selection: null }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        inspectorWidth: state.inspectorWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        inspectorCollapsed: state.inspectorCollapsed,
        viewMode: state.viewMode,
        theme: state.theme,
        drawerHeight: state.drawerHeight,
        inspectorTabMode: state.inspectorTabMode,
        activeProjectId: state.activeProjectId,
      }),
    }
  )
);

// Helper to get derived panels from the store state
export const useUIPanels = (): UIPanels => {
  const state = useUIStore();
  return deriveUIPanels({
    selection: state.selection,
    viewMode: state.viewMode,
    activeDrawer: state.activeDrawer,
    inspectorCollapsed: state.inspectorCollapsed,
    sidebarCollapsed: state.sidebarCollapsed,
    inspectorTabMode: state.inspectorTabMode,
  });
};
