import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type InspectorMode = 'record' | 'schema' | 'references' | 'links';
type ViewMode = 'workflow' | 'grid' | 'calendar' | 'columns';

interface UIState {
  // Inspector
  inspectorMode: InspectorMode;
  inspectedRecordId: string | null;
  inspectedNodeId: string | null;

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
  setInspectorMode: (mode: InspectorMode) => void;
  inspectRecord: (id: string | null) => void;
  inspectNode: (id: string | null) => void;
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
      inspectorMode: 'record',
      inspectedRecordId: null,
      inspectedNodeId: null,
      sidebarWidth: 280,
      inspectorWidth: 380,
      sidebarCollapsed: false,
      inspectorCollapsed: false,
      viewMode: 'workflow',
      theme: 'light',
      
      drawerHeight: 300,
      activeDrawer: null,

      setInspectorMode: (mode) => set({ inspectorMode: mode }),
      inspectRecord: (id) => set({ inspectedRecordId: id, inspectedNodeId: null }),
      inspectNode: (id) => set({ inspectedNodeId: id, inspectedRecordId: null }),
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
