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
import { Link, useLocation } from 'react-router-dom';

import type { ProjectViewMode, RecordsViewMode, FieldsViewMode } from '@autoart/shared';

import { useProjects } from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import {
  useUIStore,
  PROJECT_VIEW_MODE_LABELS,
  RECORDS_VIEW_MODE_LABELS,
  FIELDS_VIEW_MODE_LABELS,
} from '../../stores/uiStore';
import { Button } from '../atoms/Button';
import { IconButton } from '../atoms/IconButton';
import { Inline } from '../atoms/Inline';
import { Menu } from '../molecules/Menu';
import { SegmentedControl } from '../molecules/SegmentedControl';

export function Header() {
  const location = useLocation();
  const { data: _projects } = useProjects();
  const { getNode: _getNode } = useHierarchyStore();
  const {
    viewMode,
    setViewMode,
    activeProjectId: _activeProjectId,
    setActiveProject: _setActiveProject,
    setSelection: _setSelection,
  } = useUIStore();

  const isRecordsPage = location.pathname.startsWith('/records');
  const isFieldsPage = location.pathname.startsWith('/fields');
  const isActionsPage = location.pathname.startsWith('/actions');
  const isEventsPage = location.pathname.startsWith('/events');
  const isImportPage = location.pathname.startsWith('/import');
  const isExportPage = location.pathname.startsWith('/export');
  const isWorkbenchPage = isImportPage || isExportPage;
  const isComposerPage = location.pathname.startsWith('/composer');
  const isRegistryPage = isRecordsPage || isFieldsPage || isActionsPage || isEventsPage;



  const getViewModeData = () => {
    if (isRecordsPage) {
      return Object.entries(RECORDS_VIEW_MODE_LABELS).map(([value, label]) => ({ value, label }));
    }
    if (isFieldsPage) {
      return Object.entries(FIELDS_VIEW_MODE_LABELS).map(([value, label]) => ({ value, label }));
    }
    return Object.entries(PROJECT_VIEW_MODE_LABELS).map(([value, label]) => ({ value, label }));
  };

  return (
    <header className="h-14 bg-white flex items-center justify-between px-4 shrink-0">
      <Inline gap="sm" align="center">
        {/* Logo */}
        <Link to="/" className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold hover:bg-slate-800 transition-colors">
          A
        </Link>

        {/* Navigation Links */}
        <Inline gap="xs" className="ml-2">
          <Link to="/">
            <Button
              variant={!isRegistryPage && !isComposerPage ? 'light' : 'subtle'}
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
                variant={isRegistryPage ? 'light' : 'subtle'}
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
                component={Link}
                to="/fields"
                leftSection={<TableProperties size={16} />}
                className={isFieldsPage ? 'bg-blue-50' : ''}
              >
                Fields
              </Menu.Item>
              <Menu.Item
                component={Link}
                to="/records"
                leftSection={<Database size={16} />}
                className={isRecordsPage ? 'bg-blue-50' : ''}
              >
                Records
              </Menu.Item>
              <Menu.Item
                component={Link}
                to="/actions"
                leftSection={<Zap size={16} />}
                className={isActionsPage ? 'bg-purple-50' : ''}
              >
                Actions
              </Menu.Item>
              <Menu.Item
                component={Link}
                to="/events"
                leftSection={<Activity size={16} />}
                className={isEventsPage ? 'bg-emerald-50' : ''}
              >
                Events
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {/* Composer Link */}
          <Link to="/composer">
            <Button
              variant={isComposerPage ? 'light' : 'subtle'}
              color={isComposerPage ? 'violet' : 'gray'}
              size="sm"
              leftSection={<Wand2 size={14} />}
            >
              Composer
            </Button>
          </Link>

          {/* Workbench Dropdown */}
          <Menu>
            <Menu.Target>
              <Button
                variant={isWorkbenchPage ? 'light' : 'subtle'}
                color={isWorkbenchPage ? 'yellow' : 'gray'}
                size="sm"
                rightSection={<ChevronDown size={14} />}
                leftSection={<Hammer size={14} />}
              >
                Workbench
              </Button>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item
                component={Link}
                to="/import"
                leftSection={<FolderOpen size={16} />}
                className={location.pathname.startsWith('/import') ? 'bg-amber-50' : ''}
              >
                Import
              </Menu.Item>
              <Menu.Item
                component={Link}
                to="/export"
                leftSection={<Database size={16} />}
                className={location.pathname.startsWith('/export') ? 'bg-amber-50' : ''}
              >
                Export
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Inline>
      </Inline>

      {/* Right side controls */}
      <Inline gap="sm" align="center">
        {/* View Toggle - only on project pages */}
        {!isRegistryPage && !isComposerPage && !isWorkbenchPage && (
          <SegmentedControl
            size="xs"
            value={viewMode as string}
            onChange={(value) => setViewMode(value as ProjectViewMode | RecordsViewMode | FieldsViewMode)}
            data={getViewModeData()}
          />
        )}

        {/* Settings */}
        <Link to="/settings">
          <IconButton icon={Settings} variant="ghost" size="md" label="Settings" />
        </Link>
      </Inline>
    </header>
  );
}
