/**
 * MainLayout
 *
 * THE root application layout - the single master component.
 * Contains:
 * - Header (fixed top)
 * - DockviewReact (the main docking grid with all panels)
 * - OverlayRegistry (modals, drawers, popups)
 *
 * This is the ONLY layout component at the app level.
 * Individual panels may use a PanelLayout component for their internal structure.
 */

import { useCallback, useEffect, useRef, type FunctionComponent } from 'react';
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type IDockviewPanelProps,
  type IDockviewPanelHeaderProps,
  type IWatermarkPanelProps,
} from 'dockview';

import { Plus, MoreHorizontal, Split } from 'lucide-react';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator
} from '@autoart/ui';

import { Header } from './Header';
import { OverlayRegistry } from '../registry/OverlayRegistry';
import { CommandPalette } from '../command-palette';
import { useWorkspaceStore, useOpenPanelIds, useLayout, usePendingPanelPositions } from '../../stores/workspaceStore';
import { useVisiblePanels } from '../../stores/contextStore';
import { useUIStore } from '../../stores/uiStore';
import {
  PANEL_DEFINITIONS,
  isPermanentPanel,
  type PanelId,
} from '../../workspace/panelRegistry';
import { BUILT_IN_WORKSPACES } from '../../workspace/workspacePresets';
import { getWorkspaceColorClasses, WORKSPACE_STRIP_HEX, type WorkspaceColorName } from '../../workspace/workspaceColors';
import {
  useWorkspaceTheme,
  useThemeBehavior,
  useThemeCSS,
  useThemeRootAttributes,
  ThemedTab,
} from '../../workspace/themes';

// Import all panel components
import { CenterContentRouter } from '../workspace/CenterContentRouter';
import { SelectionInspector } from '../composites/SelectionInspector';
import { ClassificationPanel } from '../../workflows/import/panels/ClassificationPanel';
import { useImportContextOptional } from '../../workflows/import/context/ImportContextProvider';
import { RecordsPanel } from '../panels/RecordsPanel';
import { FieldsPanel } from '../panels/FieldsPanel';
import { ActionsPanel } from '../panels/ActionsPanel';
import { EventsPanel } from '../panels/EventsPanel';
import { ImportPanel } from '../panels/ImportPanel';
import { ExportPanel } from '../panels/ExportPanel';
import { ComposerPanel } from '../panels/ComposerPanel';
import { MailPanel } from '../panels/MailPanel';
import { IntakePanel } from '../panels/IntakePanel';
import { ArtCollectorPanel } from '../panels/ArtCollectorPanel';
import { ProjectPanel } from '../panels/ProjectPanel';

// ============================================================================
// PANEL SPAWN HANDLE
// ============================================================================

interface SpawnHandleProps {
  api: any;
  panelId?: string;
}

function SpawnHandle({ api }: SpawnHandleProps) {
  const { dockviewApi } = useWorkspaceStore();

  const handleSpawn = (component: string, direction: 'below' | 'right' | 'tab') => {
    if (!dockviewApi) return;

    const timestamp = Date.now();
    const newId = `${component}-${timestamp}`;
    const componentKey = component as PanelId;

    let position: any = {};
    if (direction === 'tab') {
      position = { referencePanel: api.id, direction: 'within' };
    } else {
      position = { referencePanel: api.id, direction };
    }

    // Compute initial size from panel definition
    const def = PANEL_DEFINITIONS[componentKey];
    const sizeHint = def?.defaultPlacement?.size;
    let initialWidth: number | undefined;
    let initialHeight: number | undefined;

    if (sizeHint && direction === 'right') {
      initialWidth = sizeHint > 100 ? sizeHint : Math.round(dockviewApi.width * (sizeHint / 100));
    } else if (sizeHint && direction === 'below') {
      initialHeight = sizeHint > 100 ? sizeHint : Math.round(dockviewApi.height * (sizeHint / 100));
    }

    dockviewApi.addPanel({
      id: newId,
      component: componentKey,
      title: def?.title || 'New Panel',
      position,
      ...(initialWidth !== undefined && { initialWidth }),
      ...(initialHeight !== undefined && { initialHeight }),
    });
  };

  return (
    <div className="absolute bottom-3 right-3 z-50">
      <Dropdown>
        <DropdownTrigger className="w-6 h-6 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-slate-50 rounded-full shadow-sm flex items-center justify-center transition-all focus:outline-none">
          <Plus size={14} strokeWidth={2.5} />
        </DropdownTrigger>
        <DropdownContent align="end" className="w-56">
          <DropdownLabel>Add Panel</DropdownLabel>

          <DropdownItem onSelect={() => handleSpawn('selection-inspector', 'below')}>
            <Split className="mr-2 h-4 w-4 rotate-90" />
            <span>Inspector Below</span>
          </DropdownItem>

          <DropdownItem onSelect={() => handleSpawn('selection-inspector', 'right')}>
            <Split className="mr-2 h-4 w-4" />
            <span>Inspector Right</span>
          </DropdownItem>

          <DropdownSeparator />

          <DropdownLabel>Apps</DropdownLabel>
          <DropdownItem onSelect={() => handleSpawn('import-workbench', 'tab')}>
            <span>Import</span>
          </DropdownItem>
          <DropdownItem onSelect={() => handleSpawn('export-workbench', 'tab')}>
            <span>Export</span>
          </DropdownItem>
          <DropdownItem onSelect={() => handleSpawn('composer-workbench', 'tab')}>
            <span>Composer</span>
          </DropdownItem>
          <DropdownItem onSelect={() => handleSpawn('mail-panel', 'tab')}>
            <span>Mail</span>
          </DropdownItem>

          <DropdownSeparator />

          <DropdownItem onSelect={() => handleSpawn('search-results', 'below')}>
            <MoreHorizontal className="mr-2 h-4 w-4" />
            <span>Search Results</span>
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    </div>
  );
}

// ============================================================================
// PANEL COMPONENTS
// ============================================================================

function CenterWorkspacePanel(props: IDockviewPanelProps) {
  return (
    <div className="h-full overflow-hidden bg-white relative">
      <CenterContentRouter />
      <SpawnHandle api={props.api} panelId="center-workspace" />
    </div>
  );
}

function SelectionInspectorPanel(props: IDockviewPanelProps) {
  const importContext = useImportContextOptional();

  return (
    <div className="h-full overflow-auto bg-white relative group">
      <SelectionInspector
        importContext={importContext ? {
          plan: importContext.plan,
          selectedItemId: importContext.selectedItemId,
          onSelectItem: importContext.selectItem,
        } : undefined}
      />
      <SpawnHandle api={props.api} panelId="selection-inspector" />
    </div>
  );
}

/**
 * ClassificationPanelAdapter
 *
 * Dockview adapter for ClassificationPanel - used for legacy Dockview integration.
 * Note: The primary ClassificationPanel now appears via ImportWorkflowLayout
 * as a fixed bottom region. This adapter exists for standalone Dockview usage.
 */
function ClassificationPanelAdapter(_props: IDockviewPanelProps) {
  const importContext = useImportContextOptional();
  const { importSession: globalSession, importPlan: globalPlan, setImportPlan } = useUIStore();

  // Use import context if available, otherwise fall back to global store
  const session = importContext?.session ?? globalSession;
  const plan = importContext?.plan ?? globalPlan;

  const handleResolutionsSaved = useCallback(
    (updatedPlan: any) => {
      if (importContext?.updatePlan) {
        importContext.updatePlan(updatedPlan);
      } else {
        setImportPlan(updatedPlan);
      }
    },
    [importContext, setImportPlan]
  );

  const sessionId = session?.id ?? null;

  return (
    <div className="h-full overflow-auto bg-white relative">
      <ClassificationPanel
        sessionId={sessionId}
        plan={plan}
        onResolutionsSaved={handleResolutionsSaved}
      />
    </div>
  );
}


function SearchResultsPanel(props: IDockviewPanelProps) {
  return (
    <div className="h-full overflow-auto bg-white p-4 relative">
      <div className="text-sm text-slate-500">
        Search for records, definitions, or actions...
      </div>
      <SpawnHandle api={props.api} panelId="search-results" />
    </div>
  );
}

// Component registry for Dockview
const COMPONENTS: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  'center-workspace': CenterWorkspacePanel,
  'selection-inspector': SelectionInspectorPanel,
  'classification': ClassificationPanelAdapter,
  'search-results': SearchResultsPanel,
  'records-list': RecordsPanel,
  'fields-list': FieldsPanel,
  'actions-list': ActionsPanel,
  'events-list': EventsPanel,
  'import-workbench': ImportPanel,
  'export-workbench': ExportPanel,
  'composer-workbench': ComposerPanel,
  'mail-panel': MailPanel,
  'intake-workbench': IntakePanel,
  'artcollector-workbench': ArtCollectorPanel,
  'project-panel': ProjectPanel,
};

// ============================================================================
// WATERMARK COMPONENT
// ============================================================================

function WatermarkComponent() {
  const { resetLayout, dockviewApi } = useWorkspaceStore();

  const handleReset = () => {
    resetLayout();
    if (dockviewApi) {
      dockviewApi.clear();
      const centerPanel = dockviewApi.addPanel({
        id: 'center-workspace',
        component: 'center-workspace',
        title: PANEL_DEFINITIONS['center-workspace'].title,
      });
      const inspectorDef = PANEL_DEFINITIONS['selection-inspector'];
      const inspectorSize = inspectorDef.defaultPlacement?.size;
      const inspectorWidth = inspectorSize
        ? (inspectorSize > 100 ? inspectorSize : Math.round(dockviewApi.width * (inspectorSize / 100)))
        : undefined;

      dockviewApi.addPanel({
        id: 'selection-inspector',
        component: 'selection-inspector',
        title: inspectorDef.title,
        position: {
          referencePanel: centerPanel,
          direction: 'right',
        },
        ...(inspectorWidth !== undefined && { initialWidth: inspectorWidth }),
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-500 relative">
      <p className="mb-2 text-sm">Workspace is empty</p>
      <p className="text-xs text-slate-400">Click below to restore default panels</p>
      <div className="absolute bottom-3 right-3">
        <Dropdown>
          <DropdownTrigger className="w-6 h-6 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-slate-50 rounded-full shadow-sm flex items-center justify-center transition-all focus:outline-none">
            <Plus size={14} strokeWidth={2.5} />
          </DropdownTrigger>
          <DropdownContent align="end" className="w-56">
            <DropdownLabel>Restore Workspace</DropdownLabel>
            <DropdownItem onSelect={handleReset}>
              <Split className="mr-2 h-4 w-4" />
              <span>Reset to Default Layout</span>
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </div>
  );
}

// ============================================================================
// TAB COMPONENT
// ============================================================================

/**
 * Inject swoopy corner spans directly onto the `.dv-tab` ancestor via DOM API.
 * Dockview wraps React tab content in `.dv-react-part` (100% width/height),
 * which traps absolutely-positioned children. By appending corners as siblings
 * of `.dv-react-part` they become direct children of `.dv-tab` (position: relative),
 * letting the existing CSS position them correctly.
 */
function useSwoopyCorners(innerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const tab = el.closest('.dv-tab');
    if (!tab) return;

    const left = document.createElement('span');
    left.className = 'ws-tab-corner ws-tab-corner-left';
    left.setAttribute('aria-hidden', 'true');

    const right = document.createElement('span');
    right.className = 'ws-tab-corner ws-tab-corner-right';
    right.setAttribute('aria-hidden', 'true');

    tab.appendChild(left);
    tab.appendChild(right);

    return () => {
      left.remove();
      right.remove();
    };
  }, []);
}

function IconTab(props: IDockviewPanelHeaderProps) {
  const { api } = props;
  const closePanel = useWorkspaceStore((s) => s.closePanel);
  const tabContentRef = useRef<HTMLDivElement>(null);
  useSwoopyCorners(tabContentRef);

  // Get component type from dynamic panel ID (e.g., "project-panel-123" -> "project-panel")
  const getComponentType = (panelId: string): PanelId => {
    if (panelId.startsWith('project-panel-')) {
      return 'project-panel';
    }
    return panelId as PanelId;
  };

  const componentType = getComponentType(api.id);
  const def = PANEL_DEFINITIONS[componentType];
  const Icon = def?.icon;

  // Check if this panel is bound to workspace
  const isBound = useWorkspaceStore((s) => s.boundPanelIds.has(api.id));
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // Get workspace color for bound styling
  const workspaceColor = activeWorkspaceId
    ? BUILT_IN_WORKSPACES.find((w) => w.id === activeWorkspaceId)?.color
    : null;

  // Get color classes using lookup (ensures Tailwind can detect classes)
  const colorClasses = getWorkspaceColorClasses(isBound ? workspaceColor : null);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use store's closePanel to keep Dockview and state in sync
    closePanel(api.id as PanelId);
  };

  // Build color classes for bound panels
  const boundColorClasses = isBound ? `border-l-2 ${colorClasses.borderL500}` : '';

  return (
    <div
      ref={tabContentRef}
      className={`flex items-center gap-2 text-current overflow-hidden w-full group ${boundColorClasses}`}
    >
      <div className="flex items-center gap-2 flex-1 overflow-hidden min-w-0">
        {Icon && <Icon size={14} strokeWidth={2} className="flex-shrink-0" />}
        <span className="truncate">{def?.title || api.title}</span>
      </div>
      {!isPermanentPanel(componentType) && (
        <div
          onClick={handleClose}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded cursor-pointer transition-opacity"
          role="button"
          aria-label="Close panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </div>
      )}
    </div>
  );
}

const DEFAULT_TAB_COMPONENTS = {
  'icon-tab': IconTab,
  'themed-tab': ThemedTab,
};

// ============================================================================
// MAIN LAYOUT (THE MASTER COMPONENT)
// ============================================================================

export function MainLayout() {
  const apiRef = useRef<DockviewApi | null>(null);

  const openPanelIds = useOpenPanelIds();
  const savedLayout = useLayout();
  const visiblePanels = useVisiblePanels();
  const pendingPanelPositions = usePendingPanelPositions();
  const { openPanel, saveLayout, setDockviewApi, clearPendingPositions } = useWorkspaceStore();

  // Theme integration
  const theme = useWorkspaceTheme();
  const themeRootAttributes = useThemeRootAttributes();
  useThemeCSS();
  useThemeBehavior(apiRef.current);

  // Workspace tab strip tinting — sync active workspace color to CSS variable
  const activeWorkspaceIdForTint = useWorkspaceStore((s) => s.activeWorkspaceId);
  useEffect(() => {
    const root = document.documentElement;
    const workspace = BUILT_IN_WORKSPACES.find((w) => w.id === activeWorkspaceIdForTint);
    const hex = workspace?.color
      ? WORKSPACE_STRIP_HEX[workspace.color as WorkspaceColorName]
      : null;

    if (hex) {
      root.style.setProperty('--ws-tabstrip-tint', hex);
    } else {
      root.style.removeProperty('--ws-tabstrip-tint');
    }

    return () => { root.style.removeProperty('--ws-tabstrip-tint'); };
  }, [activeWorkspaceIdForTint]);

  // Command palette global hotkey (Cmd+K / Ctrl+K)
  const openCommandPalette = useUIStore((s) => s.openCommandPalette);
  const closeOverlay = useUIStore((s) => s.closeOverlay);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // Guard against focused form elements (except when already in command palette)
        const activeEl = document.activeElement;
        const isFormElement = activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl instanceof HTMLSelectElement ||
          (activeEl instanceof HTMLElement && activeEl.isContentEditable);

        // Allow if no form element is focused, or if it's the command palette input
        const isCommandPaletteInput = activeEl?.closest('[role="combobox"]');
        if (isFormElement && !isCommandPaletteInput) {
          return;
        }

        e.preventDefault();
        closeOverlay(); // Close any active overlay before opening palette
        openCommandPalette();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCommandPalette, closeOverlay]);

  // Build tab components - theme can override
  const tabComponents = theme?.components?.tabComponent
    ? { ...DEFAULT_TAB_COMPONENTS, 'icon-tab': theme.components.tabComponent }
    : DEFAULT_TAB_COMPONENTS;

  // Theme can provide custom watermark
  const watermark = theme?.components?.watermarkComponent || WatermarkComponent;

  // Build default layout - single center workspace panel
  const buildDefaultLayout = useCallback((api: DockviewApi) => {
    const def = PANEL_DEFINITIONS['center-workspace'];
    if (!def) {
      console.error('center-workspace panel definition missing');
      return;
    }
    api.addPanel({
      id: 'center-workspace',
      component: 'center-workspace',
      title: def.title,
      tabComponent: 'icon-tab',
    });
  }, []);

  // Handle Dockview ready
  const onReady = useCallback((event: DockviewReadyEvent) => {
    apiRef.current = event.api;
    setDockviewApi(event.api);

    let layoutRestored = false;
    if (savedLayout) {
      try {
        event.api.fromJSON(savedLayout as Parameters<DockviewApi['fromJSON']>[0]);
        if (!event.api.getPanel('center-workspace')) {
          throw new Error('center-workspace panel missing after layout restore');
        }
        layoutRestored = true;
      } catch (err) {
        console.warn('Failed to restore layout, rebuilding default:', err);
        event.api.clear();
      }
    }

    if (!layoutRestored) {
      buildDefaultLayout(event.api);
    }

    event.api.onDidLayoutChange(() => {
      const state = event.api.toJSON();
      saveLayout(state as unknown as Parameters<typeof saveLayout>[0]);
    });
  }, [savedLayout, buildDefaultLayout, saveLayout, setDockviewApi]);

  // Sync panels when openPanelIds changes
  // Workspace presets provide position hints; single panel opens default to tabs
  // Handles dynamic panel IDs (e.g., project-panel-1234567890-0)
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    const consumedPositions: string[] = [];

    // Helper to extract component type from dynamic panel ID
    const getComponentType = (panelId: string): PanelId => {
      // For dynamic IDs like "project-panel-1234567890-0", extract "project-panel"
      if (panelId.startsWith('project-panel-')) {
        return 'project-panel';
      }
      return panelId as PanelId;
    };

    openPanelIds.forEach((id) => {
      if (!api.getPanel(id)) {
        const componentType = getComponentType(id);
        const def = PANEL_DEFINITIONS[componentType];
        if (!def) {
          console.warn('[MainLayout] No panel definition found for:', id, 'componentType:', componentType);
          return;
        }

        const centerPanel = api.getPanel('center-workspace');
        if (!centerPanel) {
          console.warn('[MainLayout] center-workspace panel not found; cannot add panel:', id);
          return;
        }

        // Check for position hint from workspace preset, fallback to panel's defaultPlacement
        const rawPendingPosition = pendingPanelPositions.get(id as PanelId);
        const defaultArea = def.defaultPlacement?.area;
        const rawPosition = rawPendingPosition ?? defaultArea;

        // Normalize 'left' to 'right' - Dockview does not support explicit left splits
        const effectivePosition = rawPosition === 'left' ? 'right' : rawPosition;

        if (rawPosition === 'left') {
          console.warn(
            '[MainLayout] PanelPosition "left" is not supported by Dockview; using "right" instead for panel:',
            id
          );
        }

        // Track consumed positions for cleanup (only for preset-provided positions)
        if (rawPendingPosition) {
          consumedPositions.push(id);
        }

        // Map position to dockview direction
        // 'center' and undefined both default to 'within' (tabs)
        let direction: 'within' | 'right' | 'below' = 'within';
        if (effectivePosition === 'right') {
          direction = 'right';
        } else if (effectivePosition === 'bottom') {
          direction = 'below';
        }

        // Compute initial size from panel definition
        const sizeHint = def.defaultPlacement?.size;
        let initialWidth: number | undefined;
        let initialHeight: number | undefined;

        if (sizeHint && direction === 'right') {
          initialWidth = sizeHint > 100 ? sizeHint : Math.round(api.width * (sizeHint / 100));
        } else if (sizeHint && direction === 'below') {
          initialHeight = sizeHint > 100 ? sizeHint : Math.round(api.height * (sizeHint / 100));
        }

        api.addPanel({
          id,
          component: componentType, // Use base component type, not dynamic ID
          title: def.title,
          tabComponent: 'icon-tab',
          position: {
            referencePanel: centerPanel,
            direction,
          },
          ...(initialWidth !== undefined && { initialWidth }),
          ...(initialHeight !== undefined && { initialHeight }),
        });
      }
    });

    // Clear only consumed position hints, preserving hints for panels not yet opened
    if (consumedPositions.length > 0) {
      clearPendingPositions(consumedPositions as PanelId[]);
    }

    // Close panels not in openPanelIds (handle both static and dynamic IDs)
    api.panels.forEach((panel) => {
      const panelId = panel.id;
      const isInOpenList = openPanelIds.includes(panelId as PanelId);
      const componentType = getComponentType(panelId);
      if (!isInOpenList && !isPermanentPanel(componentType)) {
        panel.api.close();
      }
    });
  }, [openPanelIds, pendingPanelPositions, clearPendingPositions]);

  // Auto-show/hide panels based on context
  useEffect(() => {
    visiblePanels.forEach((id) => {
      if (!openPanelIds.includes(id)) {
        openPanel(id);
      }
    });
  }, [visiblePanels, openPanelIds, openPanel]);

  // Cleanup
  useEffect(() => {
    return () => {
      setDockviewApi(null);
    };
  }, [setDockviewApi]);

  return (
    <div className="flex flex-col h-full" {...themeRootAttributes}>
      {/* Fixed Header */}
      <Header />

      {/* Main Dockview Area - fills remaining space */}
      <div className="flex-1 overflow-hidden h-full">
        <DockviewReact
          className="dockview-theme-light"
          onReady={onReady}
          components={COMPONENTS}
          tabComponents={tabComponents as Record<string, FunctionComponent<IDockviewPanelHeaderProps>>}
          watermarkComponent={watermark as FunctionComponent<IWatermarkPanelProps>}
        />
      </div>

      {/* Global Overlays (modals, drawers, etc.) */}
      <OverlayRegistry />

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette />
    </div>
  );
}
