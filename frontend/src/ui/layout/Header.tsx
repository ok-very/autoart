/**
 * Header
 *
 * Main application header with navigation, project selector, and view controls.
 * Uses bespoke Menu and SegmentedControl components.
 */

import {
  ChevronDown, FolderOpen, Database,
  TableProperties, Wand2, Layers, Zap, Activity, Hammer, Settings, ClipboardList
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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


export function Header() {
  const navigate = useNavigate();
  const { data: _projects } = useProjects();
  const { getNode: _getNode } = useHierarchyStore();
  const { fieldsViewMode, setFieldsViewMode, openDrawer } = useUIStore();
  const collectionMode = useCollectionModeOptional();

  const { openPanel } = useWorkspaceStore();
  const openPanelIds = useOpenPanelIds();

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
          openDrawer('start-collection', {});
        }
      } else if (newMode === 'browse') {
        collectionMode.stopCollecting();
      }
    }
  }, [setFieldsViewMode, collectionMode, openDrawer]);

  return (
    <header className="h-14 bg-white flex items-center justify-between px-4 shrink-0 shadow-sm z-50 relative border-b border-slate-200">
      <Inline gap="sm" align="center" className="w-full justify-between">
        <div className="flex items-center gap-2">
          {/* Logo */}
          <Link to="/" className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold hover:bg-slate-800 transition-colors">
            A
          </Link>

          {/* Navigation Links */}
          <Inline gap="xs" className="ml-2">
            <Button
              variant={!isRegistryActive && !isComposerActive && !isWorkbenchActive ? 'light' : 'subtle'}
              color="gray"
              size="sm"
              onClick={() => navigate('/')}
            >
              Projects
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

            {/* Composer Actions */}
            <Button
              variant={isComposerActive ? 'light' : 'subtle'}
              color={isComposerActive ? 'violet' : 'gray'}
              size="sm"
              leftSection={<Wand2 size={14} />}
              onClick={() => handleOpenPanel('composer-workbench')}
            >
              Composer
            </Button>

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
