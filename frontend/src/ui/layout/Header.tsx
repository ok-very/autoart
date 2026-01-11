/**
 * Header
 *
 * Main application header with navigation, project selector, and view controls.
 * Uses bespoke Menu and SegmentedControl components.
 */

import {
  ChevronDown, Plus, Copy, FolderOpen, Check, Library, Database,
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
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { IconButton } from '../atoms/IconButton';
import { Inline } from '../atoms/Inline';
import { Text } from '../atoms/Text';
import { Menu } from '../molecules/Menu';
import { SegmentedControl } from '../molecules/SegmentedControl';

export function Header() {
  const location = useLocation();
  const { data: projects } = useProjects();
  const { getNode } = useHierarchyStore();
  const {
    viewMode,
    setViewMode,
    activeProjectId,
    setActiveProject,
    setSelection,
    openDrawer
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

  const selectedProject = activeProjectId ? getNode(activeProjectId) : null;

  const handleSelectProject = (projectId: string) => {
    setActiveProject(projectId);
  };

  const handleCreateProject = () => {
    openDrawer('create-project', {});
  };

  const handleCloneProject = () => {
    if (!selectedProject) return;
    openDrawer('clone-project', {
      sourceProjectId: selectedProject.id,
      sourceProjectTitle: selectedProject.title,
    });
  };

  const handleOpenLibrary = () => {
    if (!selectedProject) return;
    openDrawer('project-library', {
      projectId: selectedProject.id,
      projectTitle: selectedProject.title,
    });
  };

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

        {!isRegistryPage && !isComposerPage && (
          <>
            <div className="h-6 w-px bg-slate-200 mx-1" />

            {/* Project Selector */}
            <Menu>
              <Menu.Target>
                <Button
                  variant="subtle"
                  color="gray"
                  size="sm"
                  rightSection={<ChevronDown size={14} />}
                  className="max-w-[280px]"
                >
                  {selectedProject ? (
                    <Inline gap="xs" align="center">
                      <Badge variant="project">Project</Badge>
                      <Text size="sm" weight="semibold" truncate className="max-w-[160px]">
                        {selectedProject.title}
                      </Text>
                    </Inline>
                  ) : (
                    <Text size="sm" color="muted">Select a project...</Text>
                  )}
                </Button>
              </Menu.Target>

              <Menu.Dropdown className="min-w-[280px]">
                <Menu.Item leftSection={<Plus size={16} />} onClick={handleCreateProject}>
                  New Project
                </Menu.Item>
                {selectedProject && (
                  <>
                    <Menu.Item leftSection={<Copy size={16} />} onClick={handleCloneProject}>
                      Clone Current Project
                    </Menu.Item>
                    <Menu.Item leftSection={<Library size={16} />} onClick={handleOpenLibrary}>
                      Template Library
                    </Menu.Item>
                    <Menu.Item component={Link} to="/import" leftSection={<Hammer size={16} />}>
                      Import Data
                    </Menu.Item>
                  </>
                )}

                <Menu.Divider />

                <Menu.Label>Your Projects</Menu.Label>
                {projects && projects.length > 0 ? (
                  projects.map((project) => (
                    <Menu.Item
                      key={project.id}
                      leftSection={<FolderOpen size={16} />}
                      rightSection={project.id === activeProjectId ? <Check size={16} className="text-blue-600" /> : null}
                      onClick={() => handleSelectProject(project.id)}
                      className={project.id === activeProjectId ? 'bg-blue-50' : ''}
                    >
                      <Text size="sm" truncate>{project.title}</Text>
                    </Menu.Item>
                  ))
                ) : (
                  <Text size="sm" color="muted" className="text-center py-3">
                    No projects yet
                  </Text>
                )}
              </Menu.Dropdown>
            </Menu>

            {/* Edit button */}
            {selectedProject && (
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => setSelection({ type: 'node', id: selectedProject.id })}
              >
                Edit
              </Button>
            )}
          </>
        )}
      </Inline>

      {/* Right side controls */}
      <Inline gap="sm" align="center">
        {/* View Toggle */}
        <SegmentedControl
          size="xs"
          value={viewMode as string}
          onChange={(value) => setViewMode(value as ProjectViewMode | RecordsViewMode | FieldsViewMode)}
          data={getViewModeData()}
        />

        {/* Settings */}
        <Link to="/settings">
          <IconButton icon={Settings} variant="ghost" size="md" label="Settings" />
        </Link>
      </Inline>
    </header>
  );
}
