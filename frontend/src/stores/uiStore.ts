import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Inspector Tab Mode - determines which view is shown in the inspector panel
 */
export type InspectorTabMode = 'record' | 'schema' | 'references' | 'links';

/**
 * Typed Inspector State - discriminated union for type-safe inspector state.
 * This ensures the inspector always has consistent state for what's being inspected.
 */
export type InspectorState =
  | { type: 'none' }
  | { type: 'node'; nodeId: string; tabMode: InspectorTabMode }
  | { type: 'record'; recordId: string; tabMode: InspectorTabMode };

type ViewMode = 'workflow' | 'grid' | 'calendar' | 'columns' | 'project-list';

interface UIState {
  // Inspector - legacy fields (kept for backwards compatibility, derived from inspectorState)
  inspectorMode: InspectorTabMode;
  inspectedRecordId: string | null;
  inspectedNodeId: string | null;

  // Inspector - new typed state
  inspectorState: InspectorState;

  // Layout
  sidebarWidth: number;
  inspectorWidth: number;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;

  // View
  viewMode: ViewMode;

  // Theme
  theme: 'light' | 'dark';

  // Bottom Drawer
  drawerHeight: number;
  activeDrawer: { type: string; props: Record<string, unknown> } | null;

  // Actions
  setInspectorMode: (mode: InspectorTabMode) => void;
  setInspectorTabMode: (mode: InspectorTabMode) => void; // New alias for clarity
  inspectRecord: (id: string | null) => void;
  inspectNode: (id: string | null) => void;
  clearInspector: () => void;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Drawer Actions
  setDrawerHeight: (height: number) => void;
  openDrawer: (type: string, props?: Record<string, unknown>) => void;
  closeDrawer: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Legacy inspector fields
      inspectorMode: 'record',
      inspectedRecordId: null,
      inspectedNodeId: null,

      // New typed inspector state
      inspectorState: { type: 'none' },

      sidebarWidth: 280,
      inspectorWidth: 380,
      sidebarCollapsed: false,
      inspectorCollapsed: false,
      viewMode: 'workflow',
      theme: 'light',

      drawerHeight: 300,
      activeDrawer: null,

      setInspectorMode: (mode) => set((state) => {
        // Update both legacy and new state
        const newInspectorState: InspectorState = state.inspectorState.type === 'none'
          ? { type: 'none' }
          : state.inspectorState.type === 'node'
            ? { type: 'node', nodeId: state.inspectorState.nodeId, tabMode: mode }
            : { type: 'record', recordId: state.inspectorState.recordId, tabMode: mode };

        return {
          inspectorMode: mode,
          inspectorState: newInspectorState,
        };
      }),

      setInspectorTabMode: (mode) => set((state) => {
        // Alias for setInspectorMode with clearer naming
        const newInspectorState: InspectorState = state.inspectorState.type === 'none'
          ? { type: 'none' }
          : state.inspectorState.type === 'node'
            ? { type: 'node', nodeId: state.inspectorState.nodeId, tabMode: mode }
            : { type: 'record', recordId: state.inspectorState.recordId, tabMode: mode };

        return {
          inspectorMode: mode,
          inspectorState: newInspectorState,
        };
      }),

      inspectRecord: (id) => set({
        inspectedRecordId: id,
        inspectedNodeId: null,
        inspectorMode: 'record',
        inspectorState: id
          ? { type: 'record', recordId: id, tabMode: 'record' }
          : { type: 'none' },
      }),

      inspectNode: (id) => set({
        inspectedNodeId: id,
        inspectedRecordId: null,
        inspectorMode: 'record',
        inspectorState: id
          ? { type: 'node', nodeId: id, tabMode: 'record' }
          : { type: 'none' },
      }),

      clearInspector: () => set({
        inspectedRecordId: null,
        inspectedNodeId: null,
        inspectorMode: 'record',
        inspectorState: { type: 'none' },
      }),

      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),
      setInspectorWidth: (width) => set({ inspectorWidth: Math.max(300, Math.min(500, width)) }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleInspector: () => set((state) => ({ inspectorCollapsed: !state.inspectorCollapsed })),
      setViewMode: (mode) => set({ viewMode: mode }),
      setTheme: (theme) => set({ theme }),

      setDrawerHeight: (height) => set({ drawerHeight: Math.max(100, Math.min(600, height)) }),
      openDrawer: (type, props = {}) => set({ activeDrawer: { type, props } }),
      closeDrawer: () => set({ activeDrawer: null }),
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
      }),
    }
  )
);

/**
 * Helper selector to get the current inspector context
 */
export function getInspectorContext(state: UIState): {
  itemId: string | null;
  isNode: boolean;
  tabMode: InspectorTabMode;
} {
  if (state.inspectorState.type === 'none') {
    return { itemId: null, isNode: false, tabMode: 'record' };
  }
  if (state.inspectorState.type === 'node') {
    return {
      itemId: state.inspectorState.nodeId,
      isNode: true,
      tabMode: state.inspectorState.tabMode,
    };
  }
  return {
    itemId: state.inspectorState.recordId,
    isNode: false,
    tabMode: state.inspectorState.tabMode,
  };
}
