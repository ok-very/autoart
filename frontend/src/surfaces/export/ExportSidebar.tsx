/**
 * ExportSidebar
 *
 * Left sidebar for Export Workbench containing:
 * - Project selection list with checkboxes
 * - Filter controls
 * - Select all/none actions
 */

import { Eye, Filter, FolderOpen } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useProjects } from '../../api/hooks';
import { Text, Inline, Checkbox, Badge } from '../../ui/atoms';

// ============================================================================
// TYPES
// ============================================================================

interface ExportSidebarProps {
    width: number;
    selectedProjectIds: Set<string>;
    onToggleProject: (projectId: string) => void;
    onSelectAll: (projectIds: string[]) => void;
    onSelectNone: () => void;
    onPreviewProject: (projectId: string | null) => void;
    previewingProjectId: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportSidebar({
    width,
    selectedProjectIds,
    onToggleProject,
    onSelectAll,
    onSelectNone,
    onPreviewProject,
    previewingProjectId,
}: ExportSidebarProps) {
    const { data: projects, isLoading } = useProjects();
    const [filterQuery, setFilterQuery] = useState('');

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
        <aside
            className="bg-white border-r border-slate-200 flex flex-col shrink-0"
            style={{ width }}
        >
            {/* Header */}
            <div className="p-3 border-b border-slate-200">
                <Inline justify="between" className="mb-2">
                    <Inline gap="sm">
                        <FolderOpen className="w-4 h-4 text-slate-500" />
                        <Text size="sm" weight="semibold">Projects</Text>
                        {selectedCount > 0 && (
                            <Badge size="sm" variant="default">
                                {selectedCount} selected
                            </Badge>
                        )}
                    </Inline>
                    <Inline gap="xs">
                        <button
                            className="text-xs text-blue-600 hover:underline"
                            onClick={() => onSelectAll(filteredProjects.map((p) => p.id))}
                        >
                            All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                            className="text-xs text-blue-600 hover:underline"
                            onClick={onSelectNone}
                        >
                            None
                        </button>
                    </Inline>
                </Inline>

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
                        <Text size="sm" color="muted">Loading projects...</Text>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="p-4 text-center">
                        <Text size="sm" color="muted">No projects found</Text>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredProjects.map((project) => {
                            const isSelected = selectedProjectIds.has(project.id);
                            const isPreviewing = previewingProjectId === project.id;
                            const metadata = project.metadata as Record<string, unknown> | null;

                            return (
                                <div
                                    key={project.id}
                                    className={`px-3 py-2 hover:bg-slate-50 transition-colors ${
                                        isSelected ? 'bg-emerald-50' : ''
                                    } ${isPreviewing ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                                >
                                    <Inline justify="between" align="start">
                                        <Inline gap="sm" className="flex-1 min-w-0">
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={() => onToggleProject(project.id)}
                                                label=""
                                            />
                                            <div className="flex-1 min-w-0">
                                                <Text size="sm" weight="medium" truncate className="block">
                                                    {project.title}
                                                </Text>
                                                {metadata?.client && (
                                                    <Text size="xs" color="dimmed">
                                                        {String(metadata.client)}
                                                    </Text>
                                                )}
                                            </div>
                                        </Inline>

                                        <button
                                            onClick={() => onPreviewProject(isPreviewing ? null : project.id)}
                                            className={`p-1.5 rounded-md transition-colors ${
                                                isPreviewing
                                                    ? 'bg-blue-100 text-blue-600'
                                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                            }`}
                                            title="Preview export"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </Inline>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
                <Text size="xs" color="muted">
                    {filteredProjects.length} projects
                    {filterQuery && ` (filtered from ${projects?.length || 0})`}
                </Text>
            </div>
        </aside>
    );
}

export default ExportSidebar;
