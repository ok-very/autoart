/**
 * AddPackageMenu
 *
 * Inline project picker for adding packages to the export queue.
 * Phase 1: only "From projects" option.
 */

import { clsx } from 'clsx';
import { Plus, Check, Filter, FolderOpen, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useProjects } from '../../../api/hooks';
import { useSubmitExportPackage } from '../../../api/hooks/export-packages';
import { Button, Text, Spinner } from '@autoart/ui';

interface AddPackageMenuProps {
    onAdded?: () => void;
}

export function AddPackageMenu({ onAdded }: AddPackageMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const { data: projects, isLoading: loadingProjects } = useProjects();
    const submitPackage = useSubmitExportPackage();

    const filteredProjects = useMemo(() => {
        if (!projects) return [];
        if (!filterQuery.trim()) return projects;
        const q = filterQuery.toLowerCase();
        return projects.filter((p) =>
            p.title.toLowerCase().includes(q) ||
            (typeof p.metadata === 'object' && p.metadata !== null &&
                String((p.metadata as Record<string, unknown>).client || '').toLowerCase().includes(q)),
        );
    }, [projects, filterQuery]);

    const toggleProject = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSubmit = async () => {
        if (selectedIds.size === 0) return;
        try {
            await submitPackage.mutateAsync({
                sourceType: 'project_selection',
                projectIds: Array.from(selectedIds),
            });
            setSelectedIds(new Set());
            setFilterQuery('');
            setIsOpen(false);
            onAdded?.();
        } catch {
            // Mutation error surfaces via submitPackage.isError — keep selection intact
        }
    };

    if (!isOpen) {
        return (
            <div className="p-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setIsOpen(true)}
                >
                    <Plus size={14} className="mr-2" />
                    Add package
                </Button>
            </div>
        );
    }

    return (
        <div className="border-t border-ws-panel-border">
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FolderOpen size={14} className="text-ws-muted" />
                    <Text size="xs" weight="semibold" color="muted" className="uppercase">
                        Select projects
                    </Text>
                </div>
                <button
                    onClick={() => { setIsOpen(false); setSelectedIds(new Set()); setFilterQuery(''); }}
                    className="text-ws-muted hover:text-ws-text-secondary"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Filter */}
            <div className="px-3 pb-2">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-ws-bg rounded-lg">
                    <Filter className="w-3.5 h-3.5 text-ws-muted" />
                    <input
                        type="text"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="Filter..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-ws-muted"
                    />
                </div>
            </div>

            {/* Project List */}
            <div className="max-h-48 overflow-auto">
                {loadingProjects ? (
                    <div className="p-4 text-center"><Spinner size="sm" /></div>
                ) : filteredProjects.length === 0 ? (
                    <div className="p-4 text-center">
                        <Text size="xs" color="muted">No projects found</Text>
                    </div>
                ) : (
                    filteredProjects.map((project) => {
                        const isSelected = selectedIds.has(project.id);
                        return (
                            <button
                                key={project.id}
                                className={clsx(
                                    'w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-ws-bg transition-colors',
                                    isSelected && 'bg-[var(--ws-row-expanded-bg)]',
                                )}
                                onClick={() => toggleProject(project.id)}
                            >
                                <div
                                    className={clsx(
                                        'w-3.5 h-3.5 flex items-center justify-center rounded border transition-colors',
                                        isSelected ? 'bg-[var(--ws-accent)] border-[var(--ws-accent)]' : 'border-ws-panel-border',
                                    )}
                                >
                                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <Text size="sm" className="truncate">{project.title}</Text>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Submit */}
            <div className="p-2 border-t border-ws-panel-border">
                {submitPackage.isError && (
                    <Text size="xs" className="text-[var(--ws-color-error)] px-1 pb-1.5">
                        Failed to add package
                    </Text>
                )}
                <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={selectedIds.size === 0 || submitPackage.isPending}
                    onClick={handleSubmit}
                >
                    {submitPackage.isPending
                        ? 'Adding...'
                        : `Add ${selectedIds.size} project${selectedIds.size !== 1 ? 's' : ''}`
                    }
                </Button>
            </div>
        </div>
    );
}
