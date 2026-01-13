import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ProjectViewMode, RecordsViewMode, FieldsViewMode, ViewMode } from '@autoart/shared';
import type { ImportSession, ImportPlan } from '../api/hooks/imports';
import {
  ProjectViewModeSchema,
  RecordsViewModeSchema,
  FieldsViewModeSchema,
  PROJECT_VIEW_MODE_LABELS,
  RECORDS_VIEW_MODE_LABELS,
  FIELDS_VIEW_MODE_LABELS,
} from '@autoart/shared';

import { Selection, UIPanels, InspectorMode, DrawerConfig, InspectorTabId, normalizeInspectorTabId } from '../types/ui';
import { deriveUIPanels } from '../utils/uiComposition';

// Re-export for compatibility if needed, or prefer importing from types/ui
export type { Selection, UIPanels, InspectorMode, InspectorTabId };

// Re-export view mode types and utilities from shared schemas
export type { ProjectViewMode, RecordsViewMode, FieldsViewMode, ViewMode };
export { PROJECT_VIEW_MODE_LABELS, RECORDS_VIEW_MODE_LABELS, FIELDS_VIEW_MODE_LABELS };

// Type guards for view mode categories - use schema validation
export function isProjectViewMode(mode: ViewMode): mode is ProjectViewMode {
  return ProjectViewModeSchema.safeParse(mode).success;
}

export function isRecordsViewMode(mode: ViewMode): mode is RecordsViewMode {
  return RecordsViewModeSchema.safeParse(mode).success;
}

export function isFieldsViewMode(mode: ViewMode): mode is FieldsViewMode {
  return FieldsViewModeSchema.safeParse(mode).success;
}

type Theme = 'light' | 'dark';

interface UIState {
  // Core State
  selection: Selection;
  activeProjectId: string | null;
  viewMode: ViewMode;
  inspectorTabMode: InspectorTabId;

  // Layout Geometry
  sidebarWidth: number;
  inspectorWidth: number;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  drawerCollapsed: boolean;
  drawerHeight: number;

  // Drawer State
  activeDrawer: DrawerConfig | null;

  // Theme
  theme: Theme;

  // Inspector Composer footer state
  inspectorComposerExpanded: boolean;
  setInspectorComposerExpanded: (expanded: boolean) => void;

  // Project Log preferences
  includeSystemEventsInLog: boolean;
  setIncludeSystemEventsInLog: (value: boolean) => void;

  // Registry preferences
  registryTab: 'definitions' | 'instances';
  registryDefinitionKind: 'record' | 'action_recipe' | null;
  registryScope: 'global' | 'project' | 'all';
  setRegistryTab: (tab: 'definitions' | 'instances') => void;
  setRegistryDefinitionKind: (kind: 'record' | 'action_recipe' | null) => void;
  setRegistryScope: (scope: 'global' | 'project' | 'all') => void;

  // Actions
  setSelection: (selection: Selection) => void;
  setActiveProject: (id: string | null) => void;
  setInspectorTab: (tab: InspectorTabId) => void;

  toggleSidebar: () => void;
  toggleInspector: () => void;
  toggleDrawer: () => void;
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
  readonly inspectorMode: InspectorTabId;
  setInspectorMode: (mode: InspectorTabId) => void;
  inspectRecord: (recordId: string) => void;
  inspectNode: (nodeId: string) => void;
  inspectAction: (actionId: string) => void;
  clearSelection: () => void;
  clearInspection: () => void;

  // Import workbench state
  importSession: ImportSession | null;
  importPlan: ImportPlan | null;
  setImportSession: (session: ImportSession | null) => void;
  setImportPlan: (plan: ImportPlan | null) => void;
  selectImportItem: (itemId: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      selection: null,
      activeProjectId: null,
      viewMode: 'log',
      inspectorTabMode: 'record',
      includeSystemEventsInLog: false,

      sidebarWidth: 280,
      inspectorWidth: 380,
      sidebarCollapsed: false,
      inspectorCollapsed: false,
      drawerCollapsed: false,
      drawerHeight: 380,

      activeDrawer: null,
      theme: 'light',

      inspectorComposerExpanded: false,
      setInspectorComposerExpanded: (expanded) => set({ inspectorComposerExpanded: expanded }),

      setIncludeSystemEventsInLog: (value) => set({ includeSystemEventsInLog: value }),

      // Registry preferences
      registryTab: 'instances',
      registryDefinitionKind: null,
      registryScope: 'all',
      setRegistryTab: (tab) => set({ registryTab: tab }),
      setRegistryDefinitionKind: (kind) => set({ registryDefinitionKind: kind }),
      setRegistryScope: (scope) => set({ registryScope: scope }),

      setSelection: (selection) => set({ selection }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      setInspectorTab: (tab) => set({ inspectorTabMode: tab }),

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleInspector: () => set((state) => ({ inspectorCollapsed: !state.inspectorCollapsed })),
      toggleDrawer: () => set((state) => ({ drawerCollapsed: !state.drawerCollapsed })),
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
      setDrawerHeight: (height) => set({ drawerHeight: Math.max(100, Math.min(1200, height)) }),

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
      inspectAction: (actionId) => set({ selection: { type: 'action', id: actionId }, inspectorCollapsed: false }),
      clearSelection: () => set({ selection: null }),
      clearInspection: () => set({ selection: null }),

      // Import workbench state
      importSession: null,
      importPlan: null,
      setImportSession: (session) => set({ importSession: session }),
      setImportPlan: (plan) => set({ importPlan: plan }),
      selectImportItem: (itemId) => set({
        selection: itemId ? { type: 'import_item', id: itemId } : null,
        inspectorCollapsed: false,
        inspectorTabMode: itemId ? 'import_details' : get().inspectorTabMode,
      }),
    }),
    {
      name: 'ui-storage',
      version: 1, // Increment when schema changes
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        inspectorWidth: state.inspectorWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        inspectorCollapsed: state.inspectorCollapsed,
        drawerCollapsed: state.drawerCollapsed,
        viewMode: state.viewMode,
        theme: state.theme,
        drawerHeight: state.drawerHeight,
        inspectorTabMode: state.inspectorTabMode,
        activeProjectId: state.activeProjectId,
        includeSystemEventsInLog: state.includeSystemEventsInLog,
        registryTab: state.registryTab,
        registryDefinitionKind: state.registryDefinitionKind,
        registryScope: state.registryScope,
        inspectorComposerExpanded: state.inspectorComposerExpanded,
      }),
      // Migrate stale persisted values to valid InspectorTabId
      migrate: (persistedState, version) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = persistedState as any;
        if (version < 1) {
          // Normalize any stale inspectorTabMode values
          state.inspectorTabMode = normalizeInspectorTabId(state.inspectorTabMode);
        }
        return state;
      },
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
