/**
 * Header
 *
 * Main application header with navigation, project selector, and view controls.
 * Uses bespoke Menu and SegmentedControl components.
 */

import {
  ChevronDown, FolderOpen, Database,
  TableProperties, Wand2, Layers, Zap, Activity, Hammer, Settings, ClipboardList, LayoutGrid, Check,
  AppWindow, FileText, Image, Mail, DollarSign, BarChart3
} from 'lucide-react';
import { clsx } from 'clsx';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

import type { FieldsViewMode } from '@autoart/shared';

import { useProjects } from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import {
  useUIStore,
  FIELDS_VIEW_MODE_LABELS,
} from '../../stores/uiStore';
import { useCollectionStore } from '../../stores';
import { useCollectionModeOptional } from '../../workflows/export/context/CollectionModeProvider';
import { useWorkspaceStore, useOpenPanelIds } from '../../stores/workspaceStore';
import { Button, IconButton, Inline } from '@autoart/ui';
import { Menu, SegmentedControl } from '@autoart/ui';
import { WorkspaceDropdown } from './WorkspaceDropdown';
import { BUILT_IN_WORKSPACES } from '../../workspace/workspacePresets';


export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: projects } = useProjects();
  const { getNode: _getNode } = useHierarchyStore();
  const { fieldsViewMode, setFieldsViewMode, openOverlay, setCenterContentType } = useUIStore();
  const collectionMode = useCollectionModeOptional();

  const { openPanel, setBoundProject } = useWorkspaceStore();
  const openPanelIds = useOpenPanelIds();
  const boundProjectId = useWorkspaceStore((s) => s.boundProjectId);
  const boundPanelIds = useWorkspaceStore((s) => s.boundPanelIds);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // Get workspace color for bound styling
  const rawWorkspaceColor = activeWorkspaceId
    ? BUILT_IN_WORKSPACES.find((w) => w.id === activeWorkspaceId)?.color
    : null;

  // Map workspace colors to valid Button color props
  const buttonColorMap: Record<string, 'blue' | 'gray' | 'violet' | 'yellow'> = {
    blue: 'blue',
    cyan: 'blue',
    green: 'blue',
    purple: 'violet',
    pink: 'violet',
    orange: 'yellow',
    amber: 'yellow',
    slate: 'gray',
  };
  const workspaceColor = rawWorkspaceColor ? buttonColorMap[rawWorkspaceColor] ?? 'gray' : null;

  // Check if there are any bound panels
  const hasBoundPanels = boundPanelIds.size > 0;

  // Get current bound project
  const currentBoundProject = projects?.find((p) => p.id === boundProjectId);

  // Active state derived from open panels - memoized to prevent re-computation
  const panelStates = useMemo(() => {
    const isRecordsActive = openPanelIds.includes('records-list');
    const isFieldsActive = openPanelIds.includes('fields-list');
    const isActionsActive = openPanelIds.includes('actions-list');
    const isEventsActive = openPanelIds.includes('events-list');
    const isImportActive = openPanelIds.includes('import-workbench');
    const isExportActive = openPanelIds.includes('export-workbench');
    const isComposerActive = openPanelIds.includes('composer-workbench');
    const isIntakeActive = openPanelIds.includes('intake-workbench');

    return {
      isRecordsActive,
      isFieldsActive,
      isActionsActive,
      isEventsActive,
      isImportActive,
      isExportActive,
      isComposerActive,
      isIntakeActive,
      isRegistryActive: isRecordsActive || isFieldsActive || isActionsActive || isEventsActive,
      isWorkbenchActive: isImportActive || isExportActive || isIntakeActive,
    };
  }, [openPanelIds]);

  const {
    isRecordsActive,
    isFieldsActive,
    isActionsActive,
    isEventsActive,
    isImportActive,
    isExportActive,
    isComposerActive,
    isIntakeActive,
    isRegistryActive,
    isWorkbenchActive,
  } = panelStates;

  // Helper to open panel and ensure we stay on main layout - stabilized with useCallback
  const handleOpenPanel = useCallback((panelId: any) => {
    navigate('/');
    openPanel(panelId);
  }, [navigate, openPanel]);

  // Fields view mode data for toggle (Browse/Aggregate for collection mode)
  const fieldsViewModeData = Object.entries(FIELDS_VIEW_MODE_LABELS).map(([value, label]) => ({ value, label }));

  // Handle fields view mode change with collection mode integration
  const handleFieldsViewModeChange = useCallback((value: string) => {
    const newMode = value as FieldsViewMode;
    setFieldsViewMode(newMode);

    // Toggle collection mode based on view mode
    if (collectionMode) {
      if (newMode === 'aggregate') {
        const hasActiveCollection = useCollectionStore.getState().activeCollectionId;
        if (hasActiveCollection) {
          collectionMode.startCollecting();
        } else {
          openOverlay('start-collection', {});
        }
      } else if (newMode === 'browse') {
        collectionMode.stopCollecting();
      }
    }
  }, [setFieldsViewMode, collectionMode, openOverlay]);

  return (
    <header className="h-14 bg-white flex items-center justify-between px-4 shrink-0 shadow-sm z-50 relative border-b border-slate-200">
      <Inline gap="sm" align="center" className="w-full justify-between">
        <div className="flex items-center gap-2">
          {/* Logo */}
          <Link to="/" className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold hover:bg-slate-800 transition-colors">
            A
          </Link>

          {/* Projects - primary navigation home (Link for proper anchor semantics) */}
          <Link
            to="/"
            className={clsx(
              'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors px-2 py-1 text-xs',
              location.pathname !== '/' && 'hover:bg-black/5',
            )}
            style={
              location.pathname === '/'
                ? {
                    color: 'var(--ws-accent)',
                    backgroundColor: 'color-mix(in srgb, var(--ws-accent) 12%, transparent)',
                  }
                : { color: 'var(--ws-muted-fg)' }
            }
          >
            <LayoutGrid size={14} />
            Projects
          </Link>

          {/* Workspace Dropdown - primary navigation for workflow stages */}
          <WorkspaceDropdown />

          {/* Workspace Project Selector - only shown when there are bound panels */}
          {hasBoundPanels && (
            <Menu>
              <Menu.Target>
                <Button
                  variant="light"
                  size="sm"
                  color={workspaceColor || 'gray'}
                  leftSection={<FolderOpen size={14} />}
                  rightSection={<ChevronDown size={14} />}
                >
                  {currentBoundProject?.title || 'Select Project'}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Workspace Project</Menu.Label>
                {projects?.map((p) => (
                  <Menu.Item
                    key={p.id}
                    onClick={() => setBoundProject(p.id)}
                    leftSection={p.id === boundProjectId ? <Check size={14} /> : null}
                  >
                    {p.title}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}

          {/* Navigation Links */}
          <Inline gap="xs" className="ml-2">
            {/* Workbench Dropdown */}
            <Menu>
              <Menu.Target>
                <Button
                  variant={isWorkbenchActive ? 'light' : 'subtle'}
                  color={isWorkbenchActive ? 'yellow' : 'gray'}
                  size="sm"
                  rightSection={<ChevronDown size={14} />}
                  leftSection={<Hammer size={14} />}
                >
                  Workbench
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  onClick={() => handleOpenPanel('import-workbench')}
                  leftSection={<FolderOpen size={16} />}
                  className={isImportActive ? 'bg-amber-50' : ''}
                >
                  Import
                </Menu.Item>
                <Menu.Item
                  onClick={() => handleOpenPanel('export-workbench')}
                  leftSection={<Database size={16} />}
                  className={isExportActive ? 'bg-amber-50' : ''}
                >
                  Export
                </Menu.Item>
                <Menu.Item
                  onClick={() => handleOpenPanel('intake-workbench')}
                  leftSection={<ClipboardList size={16} />}
                  className={isIntakeActive ? 'bg-amber-50' : ''}
                >
                  Intake
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Applications Dropdown */}
            <Menu>
              <Menu.Target>
                <Button
                  variant="subtle"
                  color="gray"
                  size="sm"
                  rightSection={<ChevronDown size={14} />}
                  leftSection={<AppWindow size={14} />}
                >
                  Applications
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  onClick={() => { navigate('/'); setCenterContentType('intake'); }}
                  leftSection={<FileText size={16} />}
                >
                  Forms
                </Menu.Item>
                <Menu.Item
                  onClick={() => { navigate('/'); setCenterContentType('artcollector'); }}
                  leftSection={<Image size={16} />}
                >
                  Collect
                </Menu.Item>
                <Menu.Item
                  onClick={() => { navigate('/'); setCenterContentType('mail'); }}
                  leftSection={<Mail size={16} />}
                >
                  Mail
                </Menu.Item>
                <Menu.Item
                  onClick={() => { navigate('/'); setCenterContentType('finance'); }}
                  leftSection={<DollarSign size={16} />}
                >
                  Finances
                </Menu.Item>
                <Menu.Item
                  disabled
                  leftSection={<BarChart3 size={16} />}
                >
                  Polls
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Composer */}
            <Button
              variant={isComposerActive ? 'light' : 'subtle'}
              color={isComposerActive ? 'violet' : 'gray'}
              size="sm"
              leftSection={<Wand2 size={14} />}
              onClick={() => handleOpenPanel('composer-workbench')}
            >
              Composer
            </Button>

            {/* Registry Dropdown */}
            <Menu>
              <Menu.Target>
                <Button
                  variant={isRegistryActive ? 'light' : 'subtle'}
                  color="gray"
                  size="sm"
                  rightSection={<ChevronDown size={14} />}
                  leftSection={<Layers size={14} />}
                >
                  Registry
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  onClick={() => handleOpenPanel('fields-list')}
                  leftSection={<TableProperties size={16} />}
                  className={isFieldsActive ? 'bg-blue-50' : ''}
                >
                  Fields
                </Menu.Item>
                <Menu.Item
                  onClick={() => handleOpenPanel('records-list')}
                  leftSection={<Database size={16} />}
                  className={isRecordsActive ? 'bg-blue-50' : ''}
                >
                  Records
                </Menu.Item>
                <Menu.Item
                  onClick={() => handleOpenPanel('actions-list')}
                  leftSection={<Zap size={16} />}
                  className={isActionsActive ? 'bg-purple-50' : ''}
                >
                  Actions
                </Menu.Item>
                <Menu.Item
                  onClick={() => handleOpenPanel('events-list')}
                  leftSection={<Activity size={16} />}
                  className={isEventsActive ? 'bg-emerald-50' : ''}
                >
                  Events
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

          </Inline>
        </div>

        {/* Right side controls */}
        <Inline gap="sm" align="center">
          {/* Collection Mode Toggle (Browse/Aggregate) - always visible, triggers collection mode */}
          <SegmentedControl
            size="xs"
            value={fieldsViewMode}
            onChange={handleFieldsViewModeChange}
            data={fieldsViewModeData}
          />

          {/* Settings */}
          <Link to="/settings">
            <IconButton icon={Settings} variant="ghost" size="md" label="Settings" />
          </Link>
        </Inline>
      </Inline>
    </header>
  );
}
