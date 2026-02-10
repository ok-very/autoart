/**
 * ExportWorkbenchSidebar
 *
 * Left sidebar drawer for Export Workbench.
 * Contains project selection with checkboxes and filtering,
 * per-project context indicators (staleness, email decay, in-doc),
 * and a linked Google Doc input for backfeed analysis.
 *
 * This is a DRAWER component that lives in the sidebar slot.
 */

import { clsx } from 'clsx';
import { Eye, Filter, FolderOpen, Check, ChevronRight, Link2, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useProjects } from '../../../api/hooks';
import {
    useStalenessDetection,
    useEmailDecayDetection,
    useBackfeedAnalysis,
    useCloudConnectionStatus,
} from '../../../api/hooks/exports';
import { useExportWorkbenchStore } from '../../../stores/exportWorkbenchStore';

// ============================================================================
// HELPERS
// ============================================================================

/** Extract Google Doc ID from a full URL or return as-is if already an ID */
function parseDocId(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Match: docs.google.com/document/d/{docId}/...
    const urlMatch = trimmed.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) return urlMatch[1];

    // If no slashes or dots, treat as raw doc ID
    if (!trimmed.includes('/') && !trimmed.includes('.')) return trimmed;

    return null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExportWorkbenchSidebar() {
    const { data: projects, isLoading } = useProjects();
    const [filterQuery, setFilterQuery] = useState('');
    const [docInputOpen, setDocInputOpen] = useState(false);
    const [docUrlInput, setDocUrlInput] = useState('');

    const {
        selectedProjectIds,
        previewProjectId,
        stalenessThresholdDays,
        linkedDocId,
        toggleProject,
        selectAll,
        selectNone,
        setPreviewProject,
        setLinkedDocId,
    } = useExportWorkbenchStore();

    const selectedIds = useMemo(
        () => Array.from(selectedProjectIds),
        [selectedProjectIds],
    );

    // Context helper queries — fire only for selected projects
    const { data: stalenessData } = useStalenessDetection(selectedIds, stalenessThresholdDays);
    const { data: emailDecayData } = useEmailDecayDetection(selectedIds);
    const { data: cloudStatus } = useCloudConnectionStatus();
    const backfeedMutation = useBackfeedAnalysis();

    // Build lookup maps for per-project indicators
    const staleMap = useMemo(() => {
        const map = new Map<string, boolean>();
        stalenessData?.projects.forEach((p) => {
            if (p.isStale) map.set(p.projectId, true);
        });
        return map;
    }, [stalenessData]);

    const decayMap = useMemo(() => {
        const map = new Map<string, boolean>();
        emailDecayData?.projects.forEach((p) => {
            if (p.suggestFollowup) map.set(p.projectId, true);
        });
        return map;
    }, [emailDecayData]);

    const inDocSet = useMemo(() => {
        return new Set(backfeedMutation.data?.existingProjectIds ?? []);
    }, [backfeedMutation.data]);

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
    const staleCount = staleMap.size;
    const decayCount = decayMap.size;
    const inDocCount = inDocSet.size;

    // Linked doc submit handler
    const handleDocSubmit = useCallback(() => {
        const docId = parseDocId(docUrlInput);
        if (docId) {
            setLinkedDocId(docId);
            backfeedMutation.mutate(docId);
        }
    }, [docUrlInput, setLinkedDocId, backfeedMutation]);

    const handleDocClear = useCallback(() => {
        setDocUrlInput('');
        setLinkedDocId(null);
        backfeedMutation.reset();
    }, [setLinkedDocId, backfeedMutation]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b border-ws-panel-border">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-ws-text-secondary" />
                        <span className="text-sm font-semibold text-ws-text-secondary">Projects</span>
                        {selectedCount > 0 && (
                            <span
                                className="px-1.5 py-0.5 text-xs font-medium rounded"
                                style={{
                                    background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 12%, transparent)',
                                    color: 'var(--ws-accent, #3F5C6E)',
                                }}
                            >
                                {selectedCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                        <button
                            className="hover:underline"
                            style={{ color: 'var(--ws-accent, #3F5C6E)' }}
                            onClick={() => selectAll(filteredProjects.map((p) => p.id))}
                        >
                            All
                        </button>
                        <span className="text-ws-muted">|</span>
                        <button
                            className="hover:underline"
                            style={{ color: 'var(--ws-accent, #3F5C6E)' }}
                            onClick={selectNone}
                        >
                            None
                        </button>
                    </div>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2 px-2 py-1.5 bg-ws-bg rounded-lg">
                    <Filter className="w-3.5 h-3.5 text-ws-muted" />
                    <input
                        type="text"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="Filter projects..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-ws-muted"
                    />
                </div>

                {/* Linked Doc Input (collapsible) */}
                <div className="mt-2">
                    <button
                        onClick={() => setDocInputOpen(!docInputOpen)}
                        className="flex items-center gap-1.5 text-xs w-full"
                        style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
                    >
                        <ChevronRight
                            size={12}
                            className={clsx('transition-transform duration-100', docInputOpen && 'rotate-90')}
                        />
                        <Link2 size={12} />
                        <span>Link Google Doc</span>
                        {linkedDocId && (
                            <span
                                className="ml-auto px-1 py-0.5 rounded text-[10px]"
                                style={{
                                    background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 12%, transparent)',
                                    color: 'var(--ws-accent, #3F5C6E)',
                                }}
                            >
                                linked
                            </span>
                        )}
                    </button>
                    {docInputOpen && (
                        <div className="mt-1.5">
                            {cloudStatus?.google === false ? (
                                <p
                                    className="text-xs px-1"
                                    style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
                                >
                                    Google not connected
                                </p>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={docUrlInput}
                                        onChange={(e) => setDocUrlInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleDocSubmit()}
                                        placeholder="Paste doc URL or ID..."
                                        className="flex-1 px-2 py-1 text-xs bg-ws-bg rounded outline-none placeholder:text-ws-muted"
                                        style={{ border: '1px solid var(--ws-text-disabled, #D6D2CB)' }}
                                    />
                                    {backfeedMutation.isPending ? (
                                        <Loader2
                                            size={14}
                                            className="animate-spin"
                                            style={{ color: 'var(--ws-accent, #3F5C6E)' }}
                                        />
                                    ) : linkedDocId ? (
                                        <button
                                            onClick={handleDocClear}
                                            className="text-xs px-1.5 py-0.5 rounded"
                                            style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
                                        >
                                            Clear
                                        </button>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Project List */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="p-4 text-center">
                        <span className="text-sm text-ws-muted">Loading projects...</span>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="p-4 text-center">
                        <span className="text-sm text-ws-muted">No projects found</span>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredProjects.map((project) => {
                            const isSelected = selectedProjectIds.has(project.id);
                            const isPreviewing = previewProjectId === project.id;
                            const metadata = project.metadata as Record<string, unknown> | null;
                            const isStale = isSelected && staleMap.has(project.id);
                            const needsFollowup = isSelected && decayMap.has(project.id);
                            const isInDoc = inDocSet.has(project.id);

                            return (
                                <div
                                    key={project.id}
                                    className={clsx(
                                        'px-3 py-2 hover:bg-ws-bg transition-colors cursor-pointer',
                                        isSelected && 'bg-[color-mix(in_srgb,var(--ws-accent,#3F5C6E)_4%,transparent)]',
                                        isPreviewing && 'ring-2 ring-inset'
                                    )}
                                    style={isPreviewing ? { '--tw-ring-color': 'var(--ws-accent, #3F5C6E)' } as React.CSSProperties : undefined}
                                    onClick={() => toggleProject(project.id)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            {/* Checkbox */}
                                            <div
                                                className={clsx(
                                                    'w-4 h-4 mt-0.5 flex items-center justify-center rounded border transition-colors',
                                                )}
                                                style={
                                                    isSelected
                                                        ? {
                                                              background: 'var(--ws-accent, #3F5C6E)',
                                                              borderColor: 'var(--ws-accent, #3F5C6E)',
                                                          }
                                                        : {
                                                              borderColor: 'var(--ws-text-disabled, #D6D2CB)',
                                                          }
                                                }
                                            >
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>

                                            {/* Project Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-sm font-medium text-ws-text-secondary truncate">
                                                        {project.title}
                                                    </p>
                                                    {/* In-Doc badge */}
                                                    {isInDoc && (
                                                        <span
                                                            className="shrink-0 px-1 py-0.5 rounded text-[10px] leading-none font-medium"
                                                            style={{
                                                                background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 12%, transparent)',
                                                                color: 'var(--ws-accent, #3F5C6E)',
                                                            }}
                                                        >
                                                            In Doc
                                                        </span>
                                                    )}
                                                </div>
                                                {typeof metadata?.client === 'string' && metadata.client && (
                                                    <p className="text-xs text-ws-muted truncate">
                                                        {metadata.client}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Indicators + Preview button */}
                                        <div className="flex items-center gap-1.5">
                                            {/* Staleness dot */}
                                            {isStale && (
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ background: 'var(--ws-color-warning, #B89B5E)' }}
                                                    title="Stale — no recent updates"
                                                />
                                            )}
                                            {/* Email decay dot */}
                                            {needsFollowup && (
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ background: 'var(--ws-color-error, #8C4A4A)' }}
                                                    title="Needs follow-up — unanswered email"
                                                />
                                            )}
                                            {/* Preview button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewProject(isPreviewing ? null : project.id);
                                                }}
                                                className={clsx(
                                                    'p-1.5 rounded-md transition-colors',
                                                )}
                                                style={
                                                    isPreviewing
                                                        ? {
                                                              background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 15%, transparent)',
                                                              color: 'var(--ws-accent, #3F5C6E)',
                                                          }
                                                        : {
                                                              color: 'var(--ws-text-disabled, #8C8C88)',
                                                          }
                                                }
                                                title="Preview export"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="p-3 border-t border-ws-panel-border bg-ws-bg">
                <div className="flex items-center gap-2 flex-wrap text-xs text-ws-muted">
                    <span>{filteredProjects.length} projects</span>
                    {filterQuery && <span>(filtered from {projects?.length || 0})</span>}
                    {staleCount > 0 && (
                        <span style={{ color: 'var(--ws-color-warning, #B89B5E)' }}>
                            {staleCount} stale
                        </span>
                    )}
                    {decayCount > 0 && (
                        <span style={{ color: 'var(--ws-color-error, #8C4A4A)' }}>
                            {decayCount} need follow-up
                        </span>
                    )}
                    {inDocCount > 0 && (
                        <span style={{ color: 'var(--ws-accent, #3F5C6E)' }}>
                            {inDocCount} in doc
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExportWorkbenchSidebar;
