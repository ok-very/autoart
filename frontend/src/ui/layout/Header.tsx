/**
 * Header
 *
 * Main application header with navigation, project selector, and view controls.
 * Uses Mantine Menu for dropdowns and SegmentedControl for view toggles.
 */

import { Link, useLocation } from 'react-router-dom';
import { Menu, Button, SegmentedControl, ActionIcon, Group, Text, Badge as MantineBadge, Divider } from '@mantine/core';
import {
  ChevronDown, Plus, Copy, FolderOpen, Check, Library, Database,
  TableProperties, Wand2, Layers, Zap, Activity, Hammer, Settings
} from 'lucide-react';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import {
  useUIStore,
  PROJECT_VIEW_MODE_LABELS,
  RECORDS_VIEW_MODE_LABELS,
  FIELDS_VIEW_MODE_LABELS,
} from '../../stores/uiStore';
import type { ProjectViewMode, RecordsViewMode, FieldsViewMode } from '@autoart/shared';
import { useProjects } from '../../api/hooks';

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
  const isWorkbenchPage = location.pathname.startsWith('/workbench');
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

  // Build view mode data for SegmentedControl
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
      <Group gap="sm">
        {/* Logo */}
        <Link to="/" className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold hover:bg-slate-800 transition-colors">
          A
        </Link>

        {/* Navigation Links */}
        <Group gap={4} ml="xs">
          <Button
            component={Link}
            to="/"
            variant={!isRegistryPage && !isComposerPage ? 'light' : 'subtle'}
            color="gray"
            size="sm"
          >
            Projects
          </Button>

          {/* Registry Dropdown */}
          <Menu shadow="md" width={180}>
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
          <Button
            component={Link}
            to="/composer"
            variant={isComposerPage ? 'light' : 'subtle'}
            color={isComposerPage ? 'violet' : 'gray'}
            size="sm"
            leftSection={<Wand2 size={14} />}
          >
            Composer
          </Button>

          {/* Workbench Link */}
          <Button
            component={Link}
            to="/workbench"
            variant={isWorkbenchPage ? 'light' : 'subtle'}
            color={isWorkbenchPage ? 'yellow' : 'gray'}
            size="sm"
            leftSection={<Hammer size={14} />}
          >
            Workbench
          </Button>
        </Group>

        {!isRegistryPage && !isComposerPage && (
          <>
            <Divider orientation="vertical" className="h-6 mx-1" />

            {/* Project Selector */}
            <Menu shadow="md" width={280}>
              <Menu.Target>
                <Button
                  variant="subtle"
                  color="gray"
                  size="sm"
                  rightSection={<ChevronDown size={14} />}
                  className="max-w-[280px]"
                >
                  {selectedProject ? (
                    <Group gap="xs">
                      <MantineBadge size="xs" variant="light" color="blue">Project</MantineBadge>
                      <Text size="sm" fw={600} truncate className="max-w-[160px]">
                        {selectedProject.title}
                      </Text>
                    </Group>
                  ) : (
                    <Text size="sm" c="dimmed">Select a project...</Text>
                  )}
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                {/* Actions Section */}
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
                    <Menu.Item component={Link} to="/workbench" leftSection={<Hammer size={16} />}>
                      Import Workbench
                    </Menu.Item>
                  </>
                )}

                <Menu.Divider />

                {/* Project List */}
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
                  <Text size="sm" c="dimmed" ta="center" py="md">
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
      </Group>

      {/* Right side controls */}
      <Group gap="sm">
        {/* View Toggle */}
        <SegmentedControl
          size="xs"
          value={viewMode as string}
          onChange={(value) => setViewMode(value as ProjectViewMode | RecordsViewMode | FieldsViewMode)}
          data={getViewModeData()}
        />

        {/* Settings */}
        <ActionIcon
          component={Link}
          to="/settings"
          variant="subtle"
          color="gray"
          size="lg"
        >
          <Settings size={18} />
        </ActionIcon>
      </Group>
    </header>
  );
}
