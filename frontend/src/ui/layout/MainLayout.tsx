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

import { useCallback, useEffect, useRef } from 'react';
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type IDockviewPanelProps,
  type IDockviewPanelHeaderProps,
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
import { useWorkspaceStore, useOpenPanelIds, useLayout } from '../../stores/workspaceStore';
import { useVisiblePanels } from '../../stores/contextStore';
import {
  PANEL_DEFINITIONS,
  isPermanentPanel,
  type PanelId,
} from '../../workspace/panelRegistry';

// Import all panel components
import { CentralAreaAdapter } from '../workspace/CentralAreaAdapter';
import { SelectionInspector } from '../composites/SelectionInspector';
import { ClassificationPanel } from '../../surfaces/import/ClassificationPanel';
import { RecordsPanel } from '../panels/RecordsPanel';
import { FieldsPanel } from '../panels/FieldsPanel';
import { ActionsPanel } from '../panels/ActionsPanel';
import { EventsPanel } from '../panels/EventsPanel';
import { ImportPanel } from '../panels/ImportPanel';
import { ExportPanel } from '../panels/ExportPanel';
import { ComposerPanel } from '../panels/ComposerPanel';
import { MailPanel } from '../panels/MailPanel';
import { IntakePanel } from '../panels/IntakePanel';

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

    dockviewApi.addPanel({
      id: newId,
      component: componentKey,
      title: PANEL_DEFINITIONS[componentKey]?.title || 'New Panel',
      position
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
      <CentralAreaAdapter />
      <SpawnHandle api={props.api} panelId="center-workspace" />
    </div>
  );
}

function SelectionInspectorPanel(props: IDockviewPanelProps) {
  return (
    <div className="h-full overflow-auto bg-white relative group">
      <SelectionInspector />
      <SpawnHandle api={props.api} panelId="selection-inspector" />
    </div>
  );
}

function ClassificationPanelWrapper(_props: IDockviewPanelProps) {
  return (
    <div className="h-full overflow-auto bg-white relative">
      <ClassificationPanel
        sessionId={null}
        plan={null}
        onResolutionsSaved={() => { }}
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
  'classification': ClassificationPanelWrapper,
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
      dockviewApi.addPanel({
        id: 'selection-inspector',
        component: 'selection-inspector',
        title: PANEL_DEFINITIONS['selection-inspector'].title,
        position: {
          referencePanel: centerPanel,
          direction: 'right',
        },
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

function IconTab(props: IDockviewPanelHeaderProps) {
  const { api } = props;
  const def = PANEL_DEFINITIONS[api.id as PanelId];
  const Icon = def?.icon;

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    api.close();
  };

  return (
    <div className="flex items-center gap-2 text-current overflow-hidden w-full group">
      <div className="flex items-center gap-2 flex-1 overflow-hidden min-w-0">
        {Icon && <Icon size={14} strokeWidth={2} className="flex-shrink-0" />}
        <span className="truncate">{def?.title || api.title}</span>
      </div>
      {!def?.permanent && (
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

const TAB_COMPONENTS = {
  'icon-tab': IconTab,
};

// ============================================================================
// MAIN LAYOUT (THE MASTER COMPONENT)
// ============================================================================

export function MainLayout() {
  const apiRef = useRef<DockviewApi | null>(null);

  const openPanelIds = useOpenPanelIds();
  const savedLayout = useLayout();
  const visiblePanels = useVisiblePanels();
  const { openPanel, saveLayout, setDockviewApi } = useWorkspaceStore();

  // Build default layout - single center workspace panel
  const buildDefaultLayout = useCallback((api: DockviewApi) => {
    api.addPanel({
      id: 'center-workspace',
      component: 'center-workspace',
      title: PANEL_DEFINITIONS['center-workspace'].title,
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

  // Sync panels when openPanelIds changes - add as tabs by default
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    openPanelIds.forEach((id) => {
      if (!api.getPanel(id)) {
        const def = PANEL_DEFINITIONS[id];
        if (!def) return;

        const centerPanel = api.getPanel('center-workspace');
        if (!centerPanel) return;

        // Add new panels as tabs (within) - user can drag to split
        api.addPanel({
          id,
          component: id,
          title: def.title,
          tabComponent: 'icon-tab',
          position: {
            referencePanel: centerPanel,
            direction: 'within',
          },
        });
      }
    });

    api.panels.forEach((panel) => {
      const panelId = panel.id as PanelId;
      if (!openPanelIds.includes(panelId) && !isPermanentPanel(panelId)) {
        panel.api.close();
      }
    });
  }, [openPanelIds]);

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
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      <Header />

      {/* Main Dockview Area - fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <DockviewReact
          className="dockview-theme-light"
          onReady={onReady}
          components={COMPONENTS}
          tabComponents={TAB_COMPONENTS}
          watermarkComponent={WatermarkComponent}
        />
      </div>

      {/* Global Overlays (modals, drawers, etc.) */}
      <OverlayRegistry />
    </div>
  );
}
