import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Plus, Copy, FolderOpen, Check, Library, Database, TableProperties, Wand2, Layers, Zap, Activity, Hammer, Settings } from 'lucide-react';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import {
  useUIStore,
  PROJECT_VIEW_MODE_LABELS,
  RECORDS_VIEW_MODE_LABELS,
  FIELDS_VIEW_MODE_LABELS,
} from '../../stores/uiStore';
import type { ProjectViewMode, RecordsViewMode, FieldsViewMode } from '@autoart/shared';
import { useProjects } from '../../api/hooks';
import { Badge } from '../common/Badge';

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

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRegistryDropdownOpen, setIsRegistryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const registryDropdownRef = useRef<HTMLDivElement>(null);

  const isRecordsPage = location.pathname.startsWith('/records');
  const isFieldsPage = location.pathname.startsWith('/fields');
  const isActionsPage = location.pathname.startsWith('/actions');
  const isEventsPage = location.pathname.startsWith('/events');
  const isWorkbenchPage = location.pathname.startsWith('/workbench');
  const isComposerPage = location.pathname.startsWith('/composer');
  const isRegistryPage = isRecordsPage || isFieldsPage || isActionsPage || isEventsPage;

  const selectedProject = activeProjectId ? getNode(activeProjectId) : null;

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (registryDropdownRef.current && !registryDropdownRef.current.contains(event.target as Node)) {
        setIsRegistryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProject = (projectId: string) => {
    setActiveProject(projectId);
    setIsDropdownOpen(false);
  };

  const handleCreateProject = () => {
    setIsDropdownOpen(false);
    openDrawer('create-project', {});
  };

  const handleCloneProject = () => {
    if (!selectedProject) return;
    setIsDropdownOpen(false);
    openDrawer('clone-project', {
      sourceProjectId: selectedProject.id,
      sourceProjectTitle: selectedProject.title,
    });
  };

  const handleOpenLibrary = () => {
    if (!selectedProject) return;
    setIsDropdownOpen(false);
    openDrawer('project-library', {
      projectId: selectedProject.id,
      projectTitle: selectedProject.title,
    });
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 relative z-[60] shadow-sm">
      <div className="flex items-center gap-3">
        {/* Logo */}
        <Link to="/" className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold hover:bg-slate-800 transition-colors">
          A
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 ml-2">
          <Link
            to="/"
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${!isRegistryPage && !isComposerPage
              ? 'bg-slate-100 text-slate-800'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
          >
            Projects
          </Link>

          {/* Registry Dropdown (Records & Fields) */}
          <div className="relative" ref={registryDropdownRef}>
            <button
              onClick={() => setIsRegistryDropdownOpen(!isRegistryDropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isRegistryPage
                ? 'bg-slate-100 text-slate-800'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
            >
              <Layers size={14} />
              Registry
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform ${isRegistryDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isRegistryDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden py-1">
                <Link
                  to="/fields"
                  onClick={() => setIsRegistryDropdownOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${isFieldsPage
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700'
                    }`}
                >
                  <TableProperties size={16} />
                  Fields
                </Link>
                <Link
                  to="/records"
                  onClick={() => setIsRegistryDropdownOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${isRecordsPage
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700'
                    }`}
                >
                  <Database size={16} />
                  Records
                </Link>
                <Link
                  to="/actions"
                  onClick={() => setIsRegistryDropdownOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${isActionsPage
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-slate-700'
                    }`}
                >
                  <Zap size={16} />
                  Actions
                </Link>
                <Link
                  to="/events"
                  onClick={() => setIsRegistryDropdownOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${isEventsPage
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700'
                    }`}
                >
                  <Activity size={16} />
                  Events
                </Link>
              </div>
            )}
          </div>

          {/* Composer Link */}
          <Link
            to="/composer"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isComposerPage
              ? 'bg-violet-50 text-violet-700'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
          >
            <Wand2 size={14} />
            Composer
          </Link>

          {/* Workbench Link */}
          <Link
            to="/workbench"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isWorkbenchPage
              ? 'bg-amber-50 text-amber-700'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
          >
            <Hammer size={14} />
            Workbench
          </Link>
        </nav>

        {!isRegistryPage && !isComposerPage && (
          <>
            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            {/* Project Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-200"
              >
                {selectedProject ? (
                  <>
                    <Badge variant="project">Project</Badge>
                    <span className="font-semibold text-slate-700 max-w-[200px] truncate">
                      {selectedProject.title}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">Select a project...</span>
                )}
                <ChevronDown
                  size={16}
                  className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  {/* Actions */}
                  <div className="p-2 border-b border-slate-100">
                    <button
                      onClick={handleCreateProject}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
                    >
                      <Plus size={16} />
                      <span>New Project</span>
                    </button>
                    {selectedProject && (
                      <>
                        <button
                          onClick={handleCloneProject}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
                        >
                          <Copy size={16} />
                          <span>Clone Current Project</span>
                        </button>
                        <button
                          onClick={handleOpenLibrary}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-md transition-colors"
                        >
                          <Library size={16} />
                          <span>Template Library</span>
                        </button>
                        <Link
                          to="/workbench"
                          onClick={() => setIsDropdownOpen(false)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-md transition-colors"
                        >
                          <Hammer size={16} />
                          <span>Import Workbench</span>
                        </Link>
                      </>
                    )}
                  </div>

                  {/* Project List */}
                  <div className="max-h-64 overflow-y-auto">
                    {projects && projects.length > 0 ? (
                      <div className="py-1">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Your Projects
                        </div>
                        {projects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => handleSelectProject(project.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${project.id === activeProjectId
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-700'
                              }`}
                          >
                            <FolderOpen size={16} className="shrink-0" />
                            <span className="truncate flex-1 text-left">{project.title}</span>
                            {project.id === activeProjectId && (
                              <Check size={16} className="text-blue-600 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-slate-400">
                        No projects yet. Create your first project!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Edit button when project selected */}
            {selectedProject && (
              <button
                onClick={() => setSelection({ type: 'node', id: selectedProject.id })}
                className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
              >
                Edit
              </button>
            )}
          </>
        )}
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* View Toggle - Context-Aware */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg">
          {isRecordsPage ? (
            // Records page view modes
            <>
              {(Object.entries(RECORDS_VIEW_MODE_LABELS) as [RecordsViewMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-medium rounded ${viewMode === mode
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </>
          ) : isFieldsPage ? (
            // Fields page view modes
            <>
              {(Object.entries(FIELDS_VIEW_MODE_LABELS) as [FieldsViewMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-medium rounded ${viewMode === mode
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </>
          ) : (
            // Project page view modes
            <>
              {(Object.entries(PROJECT_VIEW_MODE_LABELS) as [ProjectViewMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-medium rounded ${viewMode === mode
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Settings Link */}
        <Link
          to="/settings"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Settings"
        >
          <Settings size={18} />
        </Link>
      </div>
    </header>
  );
}
