import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Plus, Copy, FolderOpen, Check, Library, Upload, Database } from 'lucide-react';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isRecordsPage = location.pathname === '/records';

  const selectedProject = activeProjectId ? getNode(activeProjectId) : null;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
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

  const handleOpenIngestion = () => {
    if (!selectedProject) return;
    setIsDropdownOpen(false);
    openDrawer('ingestion', {});
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
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              !isRecordsPage
                ? 'bg-slate-100 text-slate-800'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            Projects
          </Link>
          <Link
            to="/records"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isRecordsPage
                ? 'bg-slate-100 text-slate-800'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Database size={14} />
            Records
          </Link>
        </nav>

        {!isRecordsPage && (
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
                    <button
                      onClick={handleOpenIngestion}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md transition-colors"
                    >
                      <Upload size={16} />
                      <span>Import CSV</span>
                    </button>
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
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                          project.id === activeProjectId
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

      {/* View Toggle */}
      <div className="flex bg-slate-100 p-0.5 rounded-lg">
        <button
          onClick={() => setViewMode('workflow')}
          className={`px-3 py-1 text-xs font-medium rounded ${
            viewMode === 'workflow'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Workflow
        </button>
        <button
          onClick={() => setViewMode('columns')}
          className={`px-3 py-1 text-xs font-medium rounded ${
            viewMode === 'columns'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Columns
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`px-3 py-1 text-xs font-medium rounded ${
            viewMode === 'grid'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Data Grid
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-3 py-1 text-xs font-medium rounded ${
            viewMode === 'calendar'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Calendar
        </button>
      </div>
    </header>
  );
}