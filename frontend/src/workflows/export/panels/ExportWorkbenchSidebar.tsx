/**
 * ExportWorkbenchSidebar
 *
 * Left sidebar drawer for Export Workbench.
 * Contains project selection with checkboxes and filtering.
 *
 * This is a DRAWER component that lives in the sidebar slot.
 */

import { clsx } from 'clsx';
import { Eye, Filter, FolderOpen, Check } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useProjects } from '../../../api/hooks';
import { useExportWorkbenchStore } from '../../../stores/exportWorkbenchStore';

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportWorkbenchSidebar() {
    const { data: projects, isLoading } = useProjects();
    const [filterQuery, setFilterQuery] = useState('');

    const {
        selectedProjectIds,
        previewProjectId,
        toggleProject,
        selectAll,
        selectNone,
        setPreviewProject,
    } = useExportWorkbenchStore();

    // Filter projects
    const filteredProjects = useMemo(() => {
        if (!projects) return [];
        if (!filterQuery.trim()) return projects;
        const query = filterQuery.toLowerCase();
        return projects.filter((p) =>
            p.title.toLowerCase().includes(query) ||
            (typeof p.metadata === 'object' && p.metadata !== null &&
                String((p.metadata as Record<string, unknown>).client || '').toLowerCase().includes(query))
        );
    }, [projects, filterQuery]);

    const selectedCount = selectedProjectIds.size;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-semibold text-slate-700">Projects</span>
                        {selectedCount > 0 && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                                {selectedCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                        <button
                            className="text-blue-600 hover:underline"
                            onClick={() => selectAll(filteredProjects.map((p) => p.id))}
                        >
                            All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                            className="text-blue-600 hover:underline"
                            onClick={selectNone}
                        >
                            None
                        </button>
                    </div>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <input
                        type="text"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="Filter projects..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                </div>
            </div>

            {/* Project List */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="p-4 text-center">
                        <span className="text-sm text-slate-400">Loading projects...</span>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="p-4 text-center">
                        <span className="text-sm text-slate-400">No projects found</span>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredProjects.map((project) => {
                            const isSelected = selectedProjectIds.has(project.id);
                            const isPreviewing = previewProjectId === project.id;
                            const metadata = project.metadata as Record<string, unknown> | null;

                            return (
                                <div
                                    key={project.id}
                                    className={clsx(
                                        'px-3 py-2 hover:bg-slate-50 transition-colors cursor-pointer',
                                        isSelected && 'bg-emerald-50',
                                        isPreviewing && 'ring-2 ring-inset ring-blue-400'
                                    )}
                                    onClick={() => toggleProject(project.id)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            {/* Checkbox */}
                                            <div
                                                className={clsx(
                                                    'w-4 h-4 mt-0.5 flex items-center justify-center rounded border transition-colors',
                                                    isSelected
                                                        ? 'bg-emerald-500 border-emerald-500'
                                                        : 'border-slate-300'
                                                )}
                                            >
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>

                                            {/* Project Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700 truncate">
                                                    {project.title}
                                                </p>
                                                {typeof metadata?.client === 'string' && metadata.client && (
                                                    <p className="text-xs text-slate-400 truncate">
                                                        {metadata.client}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Preview button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewProject(isPreviewing ? null : project.id);
                                            }}
                                            className={clsx(
                                                'p-1.5 rounded-md transition-colors',
                                                isPreviewing
                                                    ? 'bg-blue-100 text-blue-600'
                                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                            )}
                                            title="Preview export"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
                <span className="text-xs text-slate-400">
                    {filteredProjects.length} projects
                    {filterQuery && ` (filtered from ${projects?.length || 0})`}
                </span>
            </div>
        </div>
    );
}

export default ExportWorkbenchSidebar;
