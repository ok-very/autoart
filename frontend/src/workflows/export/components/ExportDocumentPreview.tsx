/**
 * ExportDocumentPreview
 *
 * Live document paper mockup rendered from `usePreviewProjection` data.
 * Paper styling: white card, Source Serif 4 headings, Source Sans 3 body.
 * Respects section toggle state from exportWorkbenchStore.
 */

import { FileText, Loader2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';

import { useCollectionStore, type SelectionReference } from '../../../stores';
import { useExportWorkbenchStore } from '../../../stores/exportWorkbenchStore';
import { usePreviewProjection } from '../../../api/hooks/exports';
import { useResolvedProjectIds } from '../utils/resolveProjectIds';
import type { BfaProjectExportModel } from '@autoart/shared';

// ============================================================================
// Component
// ============================================================================

export function ExportDocumentPreview() {
    const activeCollection = useCollectionStore(s =>
        s.activeCollectionId ? s.collections.get(s.activeCollectionId) ?? null : null
    );
    const selections: SelectionReference[] = activeCollection?.selections ?? [];
    const { projectIds } = useResolvedProjectIds(selections);
    const sectionConfig = useExportWorkbenchStore(s => s.sectionConfig);
    const options = useExportWorkbenchStore(s => s.options);

    const preview = usePreviewProjection();

    // Fetch preview when projectIds change
    const projectIdKey = projectIds.join(',');
    useEffect(() => {
        if (projectIds.length > 0) {
            preview.mutate({ projectIds, options });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectIdKey]);

    if (selections.length === 0) {
        return <EmptyState message="Add items to your collection to see a preview" />;
    }

    if (projectIds.length === 0) {
        return <EmptyState message="No projects resolved from current selections" />;
    }

    if (preview.isPending) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 size={20} className="animate-spin"
                    style={{ color: 'var(--ws-accent, #3F5C6E)' }} />
            </div>
        );
    }

    if (preview.isError) {
        return <EmptyState message="Preview unavailable" />;
    }

    if (!preview.data || preview.data.length === 0) {
        return <EmptyState message="No project data available for preview" />;
    }

    return (
        <div className="h-full overflow-y-auto p-6"
            style={{ background: 'var(--ws-bg, #F5F2ED)' }}>
            <div className="max-w-[680px] mx-auto space-y-6">
                {preview.data.map((project) => (
                    <ProjectCard
                        key={project.projectId}
                        project={project}
                        sectionConfig={sectionConfig}
                    />
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ message }: { message: string }) {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-xs">
                <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3"
                    style={{ background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 8%, transparent)' }}>
                    <FileText size={20} style={{ color: 'var(--ws-text-disabled, #8C8C88)' }} />
                </div>
                <p className="text-sm"
                    style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                    {message}
                </p>
            </div>
        </div>
    );
}

// ============================================================================
// Project Card (Paper Mockup)
// ============================================================================

interface ProjectCardProps {
    project: BfaProjectExportModel;
    sectionConfig: Record<string, boolean>;
}

function ProjectCard({ project, sectionConfig }: ProjectCardProps) {
    const showContacts = sectionConfig.includeContacts !== false;
    const showBudgets = sectionConfig.includeBudgets !== false;
    const showMilestones = sectionConfig.includeMilestones !== false;
    const showStatus = sectionConfig.includeStatusNotes !== false;

    const budgetText = useMemo(() => {
        const b = project.header.budgets;
        if (b.total?.text) return b.total.text;
        if (b.artwork?.text) return `Artwork: ${b.artwork.text}`;
        return null;
    }, [project.header.budgets]);

    return (
        <div className="rounded-lg border overflow-hidden"
            style={{
                background: '#FFFFFF',
                borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
            {/* Project Header */}
            <div className="px-6 pt-5 pb-4 border-b"
                style={{ borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))' }}>
                {/* Staff initials */}
                {project.header.staffInitials.length > 0 && (
                    <div className="flex gap-1.5 mb-2">
                        {project.header.staffInitials.map((init, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{
                                    background: 'color-mix(in srgb, var(--ws-accent, #3F5C6E) 10%, transparent)',
                                    color: 'var(--ws-accent, #3F5C6E)',
                                }}>
                                {init}
                            </span>
                        ))}
                    </div>
                )}

                {/* Client + Project name */}
                <h3 className="text-base font-semibold leading-snug"
                    style={{
                        fontFamily: '"Source Serif 4", serif',
                        color: 'var(--ws-fg, #2E2E2C)',
                    }}>
                    {project.header.clientName}
                </h3>
                <p className="text-sm mt-0.5"
                    style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
                    {project.header.projectName}
                    {project.header.location && (
                        <span style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                            {' '}&mdash; {project.header.location}
                        </span>
                    )}
                </p>

                {/* Budget + Install */}
                <div className="flex items-center gap-4 mt-2 text-xs"
                    style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                    {showBudgets && budgetText && (
                        <span style={{
                            fontFamily: '"IBM Plex Mono", monospace',
                            color: 'var(--ws-accent-secondary, #8A5A3C)',
                        }}>
                            {budgetText}
                        </span>
                    )}
                    {project.header.install.dateText && (
                        <span>Install: {project.header.install.dateText}</span>
                    )}
                    {project.statusBlock.stage && (
                        <span className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                                background: 'color-mix(in srgb, var(--ws-accent-secondary, #8A5A3C) 10%, transparent)',
                                color: 'var(--ws-accent-secondary, #8A5A3C)',
                            }}>
                            {project.statusBlock.stage}
                        </span>
                    )}
                </div>
            </div>

            {/* Sections */}
            <div className="px-6 py-4 space-y-4">
                {/* Contacts */}
                {showContacts && project.contactsBlock.lines.length > 0 && (
                    <Section title="Contacts">
                        <div className="space-y-0.5">
                            {project.contactsBlock.lines.map((line, i) => (
                                <p key={i} className="text-sm"
                                    style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
                                    {line}
                                </p>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Milestones */}
                {showMilestones && project.timelineBlock.milestones.length > 0 && (
                    <Section title="Timeline">
                        <div className="space-y-1">
                            {project.timelineBlock.milestones.map((ms, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{
                                            background: ms.status === 'completed'
                                                ? 'var(--ws-color-success, #6F7F5C)'
                                                : ms.status === 'overdue'
                                                    ? 'var(--ws-color-error, #8C4A4A)'
                                                    : 'var(--ws-color-warning, #B89B5E)',
                                        }} />
                                    <span style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
                                        {ms.kind}
                                    </span>
                                    {ms.dateText && (
                                        <span className="ml-auto text-xs"
                                            style={{
                                                fontFamily: '"IBM Plex Mono", monospace',
                                                color: 'var(--ws-text-disabled, #8C8C88)',
                                            }}>
                                            {ms.dateText}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Status / Executive Summary */}
                {showStatus && (project.statusBlock.projectStatusText || project.statusBlock.nextStepsNarrative) && (
                    <Section title="Status">
                        {project.statusBlock.projectStatusText && (
                            <p className="text-sm"
                                style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
                                {project.statusBlock.projectStatusText}
                            </p>
                        )}
                        {project.statusBlock.nextStepsNarrative && (
                            <p className="text-sm mt-1"
                                style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                                {project.statusBlock.nextStepsNarrative}
                            </p>
                        )}
                    </Section>
                )}

                {/* Next Steps */}
                {project.nextStepsBullets.length > 0 && (
                    <Section title="Next Steps">
                        <ul className="space-y-1">
                            {project.nextStepsBullets.map((bullet, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                                        style={{
                                            background: bullet.completed
                                                ? 'var(--ws-color-success, #6F7F5C)'
                                                : 'var(--ws-text-disabled, #8C8C88)',
                                        }} />
                                    <span style={{
                                        color: bullet.completed
                                            ? 'var(--ws-text-disabled, #8C8C88)'
                                            : 'var(--ws-text-secondary, #5A5A57)',
                                        textDecoration: bullet.completed ? 'line-through' : 'none',
                                    }}>
                                        {bullet.text}
                                        {bullet.assigneeHint && (
                                            <span className="ml-1 text-xs"
                                                style={{ color: 'var(--ws-accent, #3F5C6E)' }}>
                                                ({bullet.assigneeHint})
                                            </span>
                                        )}
                                        {bullet.dueHint && (
                                            <span className="ml-1 text-xs"
                                                style={{
                                                    fontFamily: '"IBM Plex Mono", monospace',
                                                    color: 'var(--ws-text-disabled, #8C8C88)',
                                                }}>
                                                {bullet.dueHint}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Section Wrapper
// ============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--ws-accent-secondary, #8A5A3C)' }}>
                {title}
            </h4>
            {children}
        </div>
    );
}
