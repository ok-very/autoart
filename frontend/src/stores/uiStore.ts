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

/**
 * Content type for center-workspace panel.
 * Determines what content is displayed in the permanent center anchor.
 */
export type CenterContentType =
  | 'projects'      // Project views (workflow, log, columns, list, cards)
  | 'artcollector'  // Art collection workflow
  | 'intake'        // Data intake workflow
  | 'export'        // Export workflow
  | 'mail'          // Communication
  | 'calendar'      // Calendar view
  | 'finance';      // Finance hub (invoices, budgets, expenses)

import { Selection, UIPanels, InspectorMode, OverlayConfig, InspectorTabId, normalizeInspectorTabId } from '../types/ui';
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

  // Center workspace content type
  centerContentType: CenterContentType;
  setCenterContentType: (type: CenterContentType) => void;

  // Namespaced view modes (each panel has its own)
  projectViewMode: ProjectViewMode;
  fieldsViewMode: FieldsViewMode;
  recordsViewMode: RecordsViewMode;

  // Legacy alias for backward compatibility
  viewMode: ViewMode;

  inspectorTabMode: InspectorTabId;

  // Layout Geometry
  sidebarWidth: number;
  inspectorWidth: number;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  overlayCollapsed: boolean;
  overlayHeight: number;

  // Overlay State
  activeOverlay: OverlayConfig | null;

  // Theme
  theme: Theme;

  // Inspector Composer footer state
  inspectorComposerExpanded: boolean;
  setInspectorComposerExpanded: (expanded: boolean) => void;

  // Unified Composer Bar state (Narrative Canvas Phase 1)
  composerBarVisible: boolean;
  composerBarExpanded: boolean;
  setComposerBarVisible: (visible: boolean) => void;
  toggleComposerBar: () => void;
  setComposerBarExpanded: (expanded: boolean) => void;

  // Project Log preferences
  includeSystemEventsInLog: boolean;
  setIncludeSystemEventsInLog: (value: boolean) => void;

  // Registry preferences
  registryTab: 'definitions' | 'instances';
  registryDefinitionKind: 'record' | 'action_arrangement' | null;
  registryScope: 'global' | 'project' | 'all';
  setRegistryTab: (tab: 'definitions' | 'instances') => void;
  setRegistryDefinitionKind: (kind: 'record' | 'action_arrangement' | null) => void;
  setRegistryScope: (scope: 'global' | 'project' | 'all') => void;

  // Actions
  setSelection: (selection: Selection) => void;
  setActiveProject: (id: string | null) => void;
  setInspectorTab: (tab: InspectorTabId) => void;

  toggleSidebar: () => void;
  toggleInspector: () => void;
  toggleOverlay: () => void;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;

  // Namespaced view mode setters
  setProjectViewMode: (mode: ProjectViewMode) => void;
  setFieldsViewMode: (mode: FieldsViewMode) => void;
  setRecordsViewMode: (mode: RecordsViewMode) => void;

  // Legacy setter (deprecated - use namespaced setters)
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: Theme) => void;

  // Overlay Actions
  openOverlay: (type: string, props?: Record<string, unknown>) => void;
  closeOverlay: () => void;
  setOverlayHeight: (height: number) => void;

  // Legacy compatibility - derived from selection
  readonly inspectedNodeId: string | null;
  readonly inspectedRecordId: string | null;
  readonly inspectorMode: InspectorTabId;
  setInspectorMode: (mode: InspectorTabId) => void;
  inspectRecord: (recordId: string) => void;
  inspectNode: (nodeId: string) => void;
  inspectAction: (actionId: string) => void;
  inspectEmail: (emailId: string) => void;
  clearSelection: () => void;
  clearInspection: () => void;

  // Import workbench state
  importSession: ImportSession | null;
  importPlan: ImportPlan | null;
  setImportSession: (session: ImportSession | null) => void;
  setImportPlan: (plan: ImportPlan | null) => void;
  selectImportItem: (itemId: string | null) => void;

  // Command palette state
  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      selection: null,
      activeProjectId: null,

      // Center workspace content type (default: projects for backward compat)
      centerContentType: 'projects' as CenterContentType,
      setCenterContentType: (type) => set({ centerContentType: type }),

      // Namespaced view modes
      projectViewMode: 'workflow' as ProjectViewMode,
      fieldsViewMode: 'browse' as FieldsViewMode,
      recordsViewMode: 'list' as RecordsViewMode,

      // Legacy alias - derives from projectViewMode for backward compat
      get viewMode(): ViewMode { return get().projectViewMode; },

      inspectorTabMode: 'record',
      includeSystemEventsInLog: false,

      sidebarWidth: 280,
      inspectorWidth: 380,
      sidebarCollapsed: false,
      inspectorCollapsed: false,
      overlayCollapsed: false,
      overlayHeight: 380,

      activeOverlay: null,
      theme: 'light',

      inspectorComposerExpanded: false,
      setInspectorComposerExpanded: (expanded) => set({ inspectorComposerExpanded: expanded }),

      // Unified Composer Bar state
      composerBarVisible: true,
      composerBarExpanded: false,
      setComposerBarVisible: (visible) => set({ composerBarVisible: visible }),
      toggleComposerBar: () => set((state) => ({ composerBarVisible: !state.composerBarVisible })),
      setComposerBarExpanded: (expanded) => set({ composerBarExpanded: expanded }),

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
      toggleOverlay: () => set((state) => ({ overlayCollapsed: !state.overlayCollapsed })),
      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),
      setInspectorWidth: (width) => set({ inspectorWidth: Math.max(300, Math.min(500, width)) }),

      // Namespaced view mode setters
      setProjectViewMode: (mode) => set((state) => {
        const shouldClearSelection = mode === 'columns' && state.projectViewMode !== 'columns';
        return {
          projectViewMode: mode,
          ...(shouldClearSelection ? { selection: null } : {}),
        };
      }),
      setFieldsViewMode: (mode) => set({ fieldsViewMode: mode }),
      setRecordsViewMode: (mode) => set({ recordsViewMode: mode }),

      // Legacy setter - routes to appropriate namespaced setter
      setViewMode: (mode) => {
        if (isProjectViewMode(mode)) {
          get().setProjectViewMode(mode);
        } else if (isFieldsViewMode(mode)) {
          get().setFieldsViewMode(mode);
        } else if (isRecordsViewMode(mode)) {
          get().setRecordsViewMode(mode);
        } else if (process.env.NODE_ENV === 'development') {
          console.warn(`setViewMode: Unrecognized view mode "${mode}"`);
        }
      },
      setTheme: (theme) => set({ theme }),

      openOverlay: (type, props = {}) => set({ activeOverlay: { type, props } }),
      closeOverlay: () => set({ activeOverlay: null }),
      setOverlayHeight: (height) => set({ overlayHeight: Math.max(100, Math.min(1200, height)) }),

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
      inspectEmail: (emailId) => set({ selection: { type: 'email', id: emailId }, inspectorCollapsed: false }),
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

      // Command palette state
      commandPaletteOpen: false,
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
    }),
    {
      name: 'ui-storage',
      version: 5, // v5: Rename drawer to overlay
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        inspectorWidth: state.inspectorWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        inspectorCollapsed: state.inspectorCollapsed,
        overlayCollapsed: state.overlayCollapsed,
        // Center content type
        centerContentType: state.centerContentType,
        // Namespaced view modes
        projectViewMode: state.projectViewMode,
        fieldsViewMode: state.fieldsViewMode,
        recordsViewMode: state.recordsViewMode,
        theme: state.theme,
        overlayHeight: state.overlayHeight,
        inspectorTabMode: state.inspectorTabMode,
        activeProjectId: state.activeProjectId,
        includeSystemEventsInLog: state.includeSystemEventsInLog,
        registryTab: state.registryTab,
        registryDefinitionKind: state.registryDefinitionKind,
        registryScope: state.registryScope,
        inspectorComposerExpanded: state.inspectorComposerExpanded,
        // Unified Composer Bar
        composerBarVisible: state.composerBarVisible,
        composerBarExpanded: state.composerBarExpanded,
      }),
      // Migrate persisted state across versions
      migrate: (persistedState, version) => {
        // Clone to avoid mutating the original persisted snapshot
        const state = { ...(persistedState as any) };

        if (version < 1) {
          // Normalize any stale inspectorTabMode values
          state.inspectorTabMode = normalizeInspectorTabId(state.inspectorTabMode);
        }

        if (version < 3) {
          // v3: Migrate from single viewMode to namespaced modes
          const oldViewMode = state.viewMode;
          if (oldViewMode) {
            // Map old viewMode to appropriate namespaced mode
            if (['log', 'workflow', 'columns'].includes(oldViewMode)) {
              state.projectViewMode = oldViewMode;
            } else if (oldViewMode === 'grid' || oldViewMode === 'calendar') {
              // Migrate removed modes to 'cards'
              state.projectViewMode = 'cards';
            }
          }
          // Set defaults for new fields
          state.projectViewMode = state.projectViewMode || 'workflow';
          state.fieldsViewMode = state.fieldsViewMode || 'browse';
          state.recordsViewMode = state.recordsViewMode || 'list';
          delete state.viewMode;
        }

        if (version < 4) {
          // v4: Rename action_recipe to action_arrangement
          if (state.registryDefinitionKind === 'action_recipe') {
            state.registryDefinitionKind = 'action_arrangement';
          }
        }

        if (version < 5) {
          // v5: Rename drawer to overlay
          if ('drawerCollapsed' in state) {
            state.overlayCollapsed = state.drawerCollapsed;
            delete state.drawerCollapsed;
          }
          if ('drawerHeight' in state) {
            state.overlayHeight = state.drawerHeight;
            delete state.drawerHeight;
          }
        }

        // Ensure centerContentType has a default value
        state.centerContentType = state.centerContentType || 'projects';

        return state;
      },
    }
  )
);

// Helper to get derived panels from the store state
// Uses a selector to avoid re-renders on unrelated state changes
export const useUIPanels = (): UIPanels => {
  return useUIStore((state) =>
    deriveUIPanels({
      selection: state.selection,
      projectViewMode: state.projectViewMode,
      activeOverlay: state.activeOverlay,
      inspectorCollapsed: state.inspectorCollapsed,
      sidebarCollapsed: state.sidebarCollapsed,
      inspectorTabMode: state.inspectorTabMode,
    })
  );
};
