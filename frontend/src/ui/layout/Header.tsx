/**
 * Header
 *
 * Main application header with navigation, project selector, and view controls.
 * Uses bespoke Menu and SegmentedControl components.
 */

import {
  ChevronDown, FolderOpen, Database,
  TableProperties, Wand2, Layers, Zap, Activity, Hammer, Settings
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

import type { ProjectViewMode, RecordsViewMode, FieldsViewMode } from '@autoart/shared';

import { useProjects } from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import {
  useUIStore,
  PROJECT_VIEW_MODE_LABELS,
  RECORDS_VIEW_MODE_LABELS,
  FIELDS_VIEW_MODE_LABELS,
} from '../../stores/uiStore';
import { useWorkspaceStore, useOpenPanelIds } from '../../stores/workspaceStore';
import { useCollectionStore } from '../../stores';
import { useCollectionModeOptional } from '../../surfaces/export/CollectionModeProvider';
import { Button } from '@autoart/ui';
import { IconButton } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Menu, SegmentedControl } from '@autoart/ui';


export function Header() {
  const navigate = useNavigate();
  const { data: _projects } = useProjects();
  const { getNode: _getNode } = useHierarchyStore();
  const {
    viewMode,
    setViewMode,
    openDrawer,
  } = useUIStore();

  const { openPanel } = useWorkspaceStore();
  const openPanelIds = useOpenPanelIds();
  const collectionMode = useCollectionModeOptional();

  // Active state derived from open panels - memoized to prevent re-computation
  const panelStates = useMemo(() => {
    const isRecordsActive = openPanelIds.includes('records-list');
    const isFieldsActive = openPanelIds.includes('fields-list');
    const isActionsActive = openPanelIds.includes('actions-list');
    const isEventsActive = openPanelIds.includes('events-list');
    const isImportActive = openPanelIds.includes('import-workbench');
    const isExportActive = openPanelIds.includes('export-workbench');
    const isComposerActive = openPanelIds.includes('composer-workbench');

    return {
      isRecordsActive,
      isFieldsActive,
      isActionsActive,
      isEventsActive,
      isImportActive,
      isExportActive,
      isComposerActive,
      isRegistryActive: isRecordsActive || isFieldsActive || isActionsActive || isEventsActive,
      isWorkbenchActive: isImportActive || isExportActive,
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
    isRegistryActive,
    isWorkbenchActive,
  } = panelStates;

  // Helper to open panel and ensure we stay on main layout - stabilized with useCallback
  const handleOpenPanel = useCallback((panelId: any) => {
    navigate('/');
    openPanel(panelId);
  }, [navigate, openPanel]);

  const getViewModeData = () => {
    if (isRecordsActive) {
      return Object.entries(RECORDS_VIEW_MODE_LABELS).map(([value, label]) => ({ value, label }));
    }
    if (isFieldsActive) {
      return Object.entries(FIELDS_VIEW_MODE_LABELS).map(([value, label]) => ({ value, label }));
    }
    return Object.entries(PROJECT_VIEW_MODE_LABELS).map(([value, label]) => ({ value, label }));
  };

  // Determine if view toggle should be shown (for registry panels)
  // When Fields is active, Browse/Aggregate controls collection mode
  const showViewToggle = isRecordsActive || isFieldsActive;

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
            <Link to="/">
              <Button
                variant={!isRegistryActive && !isComposerActive && !isWorkbenchActive ? 'light' : 'subtle'}
                color="gray"
                size="sm"
              >
                Projects
              </Button>
            </Link>

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
              </Menu.Dropdown>
            </Menu>
          </Inline>
        </div>

        {/* Right side controls */}
        <Inline gap="sm" align="center">
          {/* View Toggle */}
          {showViewToggle && (
            <SegmentedControl
              size="xs"
              value={viewMode as string}
              onChange={(value) => {
                setViewMode(value as ProjectViewMode | RecordsViewMode | FieldsViewMode);
                // Toggle collection mode when switching between browse/aggregate in Fields panel
                if (isFieldsActive && collectionMode) {
                  if (value === 'aggregate') {
                    // Check if there's an active collection
                    const hasActiveCollection = useCollectionStore.getState().activeCollectionId;
                    if (hasActiveCollection) {
                      collectionMode.startCollecting();
                    } else {
                      // Show modal to start new collection
                      openDrawer('start-collection', {});
                    }
                  } else if (value === 'browse') {
                    collectionMode.stopCollecting();
                  }
                }
              }}
              data={getViewModeData()}
            />
          )}

          {/* Settings */}
          <Link to="/settings">
            <IconButton icon={Settings} variant="ghost" size="md" label="Settings" />
          </Link>
        </Inline>
      </Inline>
    </header>
  );
}
