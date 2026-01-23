/**
 * ExportPreview
 *
 * Side-by-side preview showing original vs regenerated export.
 * Highlights changes between imported data and current state.
 */

import { ArrowRight, FileText, Edit3, Loader2 } from 'lucide-react';
import { useMemo } from 'react';

import type { ExportFormat, ExportOptions, BfaProjectExportModel } from '../types';
import { useExportProjection } from '../../../api/hooks/exports';
import { Card, Inline, Text, Stack, Badge } from '@autoart/ui';

export interface ExportPreviewProps {
    projectId: string;
    format: ExportFormat;
    options: ExportOptions;
    /** Session ID for fetching real projection data */
    sessionId?: string | null;
}

export function ExportPreview({ projectId, format, options, sessionId }: ExportPreviewProps) {
    // Fetch real projection data if session exists
    const { data: projectionData, isLoading, error } = useExportProjection(sessionId ?? null);

    // Find the specific project's export model from the projection
    const exportModel: BfaProjectExportModel | null = useMemo(() => {
        // If we have real projection data, find the project
        if (projectionData) {
            const found = projectionData.find((p) => p.projectId === projectId);
            if (found) return found;
        }

        // Fallback to placeholder data for preview without session
        return {
            projectId,
            orderingIndex: 1,
            category: 'public' as const,
            header: {
                staffInitials: ['JB', 'NY'],
                clientName: 'Sample Client',
                projectName: 'Sample Project',
                location: 'Vancouver',
                budgets: {
                    artwork: { numeric: 500000, text: '$500,000' },
                    total: { numeric: 650000, text: '$650,000' },
                },
                install: { dateText: '2026', statusText: undefined },
            },
            contactsBlock: {
                lines: [
                    'PM: Jane Doe (Sample Corp)',
                    'Architect: John Smith (ABC Architecture)',
                ],
            },
            timelineBlock: {
                milestones: [
                    { kind: 'PPAP', dateText: 'March 2025', status: 'completed' as const },
                    { kind: 'DPAP', dateText: 'June 2025', status: 'scheduled' as const },
                ],
            },
            selectionPanelBlock: {
                members: [],
                shortlist: [],
                alternates: [],
            },
            statusBlock: {
                projectStatusText: 'In progress',
                bfaProjectStatusText: 'Awaiting DPAP approval',
                stage: 'planning' as const,
            },
            nextStepsBullets: [
                { text: 'Submit DPAP documents', completed: false, ownerHint: 'BFA' },
                { text: 'Schedule SP#1', completed: false, ownerHint: 'BFA' },
            ],
            rawBlockText: '(JB/NY) Sample Client: Sample Project, Vancouver (Art: $500,000 | Total: $650,000) Install: 2026\n\nPM: Jane Doe (Sample Corp)\nArchitect: John Smith (ABC Architecture)\n\nPPAP: March 2025\nDPAP: June 2025\n\nProject Status: In progress\nBFA Project Status: Awaiting DPAP approval\n\n● Submit DPAP documents\n● Schedule SP#1',
            hasChanges: false,
        };
    }, [projectId, projectionData]);

    // Loading state
    if (isLoading && sessionId) {
        return (
            <Card padding="lg" className="text-center">
                <Stack gap="sm" className="items-center">
                    <Loader2 size={24} className="text-slate-400 animate-spin" />
                    <Text color="dimmed">Loading preview...</Text>
                </Stack>
            </Card>
        );
    }

    // Error state
    if (error) {
        return (
            <Card padding="lg" className="text-center bg-red-50 border-red-200">
                <Text className="text-red-700">Failed to load preview: {error.message}</Text>
            </Card>
        );
    }

    if (!exportModel) {
        return (
            <Card padding="lg" className="text-center">
                <Text color="dimmed">No preview available</Text>
            </Card>
        );
    }

    return (
        <Stack gap="md">
            {/* Header */}
            <Inline justify="between">
                <Inline gap="sm">
                    <Text size="lg" weight="bold">{exportModel.header.projectName}</Text>
                    <Badge variant="default">{exportModel.header.clientName}</Badge>
                    {exportModel.hasChanges && (
                        <Badge variant="process">
                            <Edit3 size={12} className="mr-1" />
                            Modified
                        </Badge>
                    )}
                </Inline>
                <Badge variant="stage">{format.toUpperCase()}</Badge>
            </Inline>

            {/* Two-column comparison */}
            <div className="grid grid-cols-2 gap-4">
                {/* Original */}
                <Card padding="md" className="bg-slate-50">
                    <Inline gap="xs" className="mb-3">
                        <FileText size={14} className="text-slate-500" />
                        <Text size="xs" weight="semibold" color="dimmed" className="uppercase tracking-wide">
                            Original Import
                        </Text>
                    </Inline>
                    <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {exportModel.rawBlockText}
                    </pre>
                </Card>

                {/* Regenerated */}
                <Card padding="md" className="bg-white border-emerald-200">
                    <Inline gap="xs" className="mb-3">
                        <ArrowRight size={14} className="text-emerald-600" />
                        <Text size="xs" weight="semibold" color="dimmed" className="uppercase tracking-wide">
                            Export Preview
                        </Text>
                    </Inline>
                    <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {renderPreview(exportModel, format, options)}
                    </pre>
                </Card>
            </div>

            {/* Export model details */}
            <Card padding="md">
                <Text size="xs" weight="semibold" color="dimmed" className="uppercase tracking-wide mb-3">
                    Structured Data
                </Text>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <Text size="xs" color="dimmed">Staff</Text>
                        <Text>{exportModel.header?.staffInitials?.join(', ') ?? '—'}</Text>
                    </div>
                    <div>
                        <Text size="xs" color="dimmed">Location</Text>
                        <Text>{exportModel.header.location}</Text>
                    </div>
                    <div>
                        <Text size="xs" color="dimmed">Artwork Budget</Text>
                        <Text>{exportModel.header.budgets.artwork?.text || 'TBC'}</Text>
                    </div>
                    <div>
                        <Text size="xs" color="dimmed">Total Budget</Text>
                        <Text>{exportModel.header.budgets.total?.text || 'TBC'}</Text>
                    </div>
                    <div>
                        <Text size="xs" color="dimmed">Install</Text>
                        <Text>{exportModel.header.install.dateText || exportModel.header.install.statusText || 'TBD'}</Text>
                    </div>
                    <div>
                        <Text size="xs" color="dimmed">Stage</Text>
                        <Badge variant="stage">{exportModel.statusBlock.stage || 'Unknown'}</Badge>
                    </div>
                </div>

                {/* Milestones */}
                {(exportModel.timelineBlock?.milestones?.length ?? 0) > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <Text size="xs" color="dimmed" className="mb-2">Milestones</Text>
                        <div className="flex flex-row flex-wrap gap-2">
                            {exportModel.timelineBlock.milestones.map((m, i) => (
                                <Badge
                                    key={i}
                                    variant={m.status === 'completed' ? 'task' : 'default'}
                                >
                                    {m.kind}: {m.dateText}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Next Steps */}
                {(exportModel.nextStepsBullets?.length ?? 0) > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <Text size="xs" color="dimmed" className="mb-2">
                            Next Steps ({exportModel.nextStepsBullets?.filter(b => !b.completed).length ?? 0} open)
                        </Text>
                        <ul className="space-y-1">
                            {exportModel.nextStepsBullets.map((bullet, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className={bullet.completed ? 'text-emerald-500' : 'text-slate-400'}>
                                        {bullet.completed ? '✓' : '●'}
                                    </span>
                                    <span className={bullet.completed ? 'text-slate-400 line-through' : ''}>
                                        {bullet.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </Card>
        </Stack>
    );
}

/**
 * Render preview text based on format
 */
function renderPreview(model: BfaProjectExportModel, _format: ExportFormat, options: ExportOptions): string {
    const lines: string[] = [];

    // Header line
    const initials = model.header.staffInitials.length > 0
        ? `(${model.header.staffInitials.join('/')}) `
        : '';
    const budgetStr = [
        model.header.budgets.artwork?.text ? `Art: ${model.header.budgets.artwork.text}` : null,
        model.header.budgets.total?.text ? `Total: ${model.header.budgets.total.text}` : null,
    ].filter(Boolean).join(' | ');
    const installStr = model.header.install.dateText || model.header.install.statusText || 'TBD';

    lines.push(`${initials}${model.header.clientName}: ${model.header.projectName}, ${model.header.location} (${budgetStr}) Install: ${installStr}`);
    lines.push('');

    // Contacts
    if (options.includeContacts && model.contactsBlock.lines.length > 0) {
        lines.push(...model.contactsBlock.lines);
        lines.push('');
    }

    // Milestones
    if (options.includeMilestones && model.timelineBlock.milestones.length > 0) {
        for (const m of model.timelineBlock.milestones) {
            lines.push(`${m.kind}: ${m.dateText || 'TBC'}`);
        }
        lines.push('');
    }

    // Status
    if (options.includeStatusNotes) {
        if (model.statusBlock.projectStatusText) {
            lines.push(`Project Status: ${model.statusBlock.projectStatusText}`);
        }
        if (model.statusBlock.bfaProjectStatusText) {
            lines.push(`BFA Project Status: ${model.statusBlock.bfaProjectStatusText}`);
        }
        if (model.statusBlock.projectStatusText || model.statusBlock.bfaProjectStatusText) {
            lines.push('');
        }
    }

    // Next Steps
    const bullets = options.includeOnlyOpenNextSteps
        ? model.nextStepsBullets.filter((b) => !b.completed)
        : model.nextStepsBullets;

    if (bullets.length > 0) {
        for (const bullet of bullets) {
            const symbol = bullet.completed ? '✓' : '●';
            lines.push(`${symbol} ${bullet.text}`);
        }
    }

    return lines.join('\n').trim();
}
