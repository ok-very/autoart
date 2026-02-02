/**
 * ExportProjectList
 *
 * Selectable list of projects for export.
 */

import { Eye } from 'lucide-react';

import type { HierarchyNode } from '@autoart/shared';

import { Inline, Text, Checkbox } from '@autoart/ui';

export interface ExportProjectListProps {
    projects: HierarchyNode[];
    selectedIds: Set<string>;
    onToggle: (projectId: string) => void;
    onPreview: (projectId: string | null) => void;
    previewingId: string | null;
}

export function ExportProjectList({
    projects,
    selectedIds,
    onToggle,
    onPreview,
    previewingId,
}: ExportProjectListProps) {
    if (projects.length === 0) {
        return (
            <div className="p-4 text-center">
                <Text size="sm" color="dimmed">No projects available</Text>
            </div>
        );
    }

    return (
        <div className="divide-y divide-slate-100">
            {projects.map((project) => {
                const isSelected = selectedIds.has(project.id);
                const isPreviewing = previewingId === project.id;

                return (
                    <div
                        key={project.id}
                        className={`px-3 py-2 hover:bg-ws-bg transition-colors ${isSelected ? 'bg-emerald-50' : ''
                            } ${isPreviewing ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                    >
                        <Inline justify="between" align="start">
                            <Inline gap="sm" className="flex-1 min-w-0">
                                <Checkbox
                                    checked={isSelected}
                                    onChange={() => onToggle(project.id)}
                                    label=""
                                />
                                <div className="flex-1 min-w-0">
                                    <Text size="sm" weight="medium" truncate className="block">
                                        {project.title}
                                    </Text>
                                    {project.metadata && typeof project.metadata === 'object' && (
                                        <Inline gap="xs" className="mt-0.5">
                                            {(() => {
                                                const meta = project.metadata as Record<string, unknown>;
                                                return meta.client ? (
                                                    <Text size="xs" color="dimmed">
                                                        {String(meta.client)}
                                                    </Text>
                                                ) : null;
                                            })()}
                                        </Inline>
                                    )}
                                </div>
                            </Inline>

                            <button
                                type="button"
                                onClick={() => onPreview(isPreviewing ? null : project.id)}
                                className={`p-1.5 rounded-md transition-colors ${isPreviewing
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'text-ws-muted hover:text-ws-text-secondary hover:bg-slate-100'
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
    );
}
