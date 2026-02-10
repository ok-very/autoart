/**
 * ContextSummaryPanel
 *
 * Collapsible context panel showing staleness, email decay, and backfeed
 * analysis for the current project selection. Sits between the format bar
 * and preview area in ExportWorkbenchContent.
 *
 * Design: --ws-* tokens only. Muted, informational. Collapsed by default.
 * Sections with no data are hidden entirely.
 */

import { clsx } from 'clsx';
import { ChevronRight, Clock, Mail, FileText } from 'lucide-react';
import { useState, useMemo } from 'react';

import {
    useStalenessDetection,
    useEmailDecayDetection,
} from '../../../api/hooks/exports';
import type {
    StaleProjectInfo,
    EmailDecayInfo,
    BackfeedMatch,
} from '../types';

// ============================================================================
// PROPS
// ============================================================================

interface ContextSummaryPanelProps {
    projectIds: string[];
    thresholdDays: number;
    onThresholdChange: (days: number) => void;
    /** Backfeed results passed from parent (mutation-driven, not auto-fetched) */
    backfeedProjectIds?: string[];
    backfeedMatches?: BackfeedMatch[];
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function Section({
    icon: Icon,
    label,
    summary,
    color,
    children,
}: {
    icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
    label: string;
    summary: string;
    color: string;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div
            className="border-b last:border-b-0"
            style={{ borderColor: 'var(--ws-text-disabled, #D6D2CB)' }}
        >
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-[var(--ws-row-expanded-bg)]"
            >
                <ChevronRight
                    size={14}
                    className={clsx('transition-transform duration-100', open && 'rotate-90')}
                    style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
                />
                <Icon size={14} style={{ color }} />
                <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
                >
                    {label}
                </span>
                <span
                    className="text-xs ml-auto"
                    style={{ color }}
                >
                    {summary}
                </span>
            </button>
            {open && (
                <div className="px-4 pb-2">
                    {children}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ContextSummaryPanel({
    projectIds,
    thresholdDays,
    onThresholdChange,
    backfeedProjectIds,
    backfeedMatches,
}: ContextSummaryPanelProps) {
    const { data: stalenessData } = useStalenessDetection(projectIds, thresholdDays);
    const { data: emailDecayData } = useEmailDecayDetection(projectIds);

    const staleProjects = stalenessData?.projects.filter((p) => p.isStale) ?? [];
    const followupProjects = emailDecayData?.needingFollowup ?? [];
    const inDocCount = backfeedProjectIds?.length ?? 0;

    const hasAnything = staleProjects.length > 0 || followupProjects.length > 0 || inDocCount > 0;

    if (projectIds.length === 0 || !hasAnything) return null;

    return (
        <div
            className="border-b"
            style={{
                borderColor: 'var(--ws-text-disabled, #D6D2CB)',
                background: 'var(--ws-bg, #F5F2ED)',
            }}
        >
            {/* Staleness section */}
            {staleProjects.length > 0 && (
                <Section
                    icon={Clock}
                    label="Staleness"
                    summary={`${staleProjects.length} of ${projectIds.length} stale (>${thresholdDays}d)`}
                    color="var(--ws-color-warning, #B89B5E)"
                >
                    <ThresholdSlider value={thresholdDays} onChange={onThresholdChange} />
                    <StaleProjectList projects={staleProjects} />
                </Section>
            )}

            {/* Email decay section */}
            {followupProjects.length > 0 && (
                <Section
                    icon={Mail}
                    label="Email Decay"
                    summary={`${followupProjects.length} need follow-up`}
                    color="var(--ws-color-error, #8C4A4A)"
                >
                    <EmailDecayList projects={followupProjects} />
                </Section>
            )}

            {/* Backfeed section */}
            {inDocCount > 0 && backfeedMatches && (
                <Section
                    icon={FileText}
                    label="In Document"
                    summary={`${inDocCount} of ${projectIds.length} in doc`}
                    color="var(--ws-accent, #3F5C6E)"
                >
                    <BackfeedList matches={backfeedMatches} />
                </Section>
            )}
        </div>
    );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ThresholdSlider({
    value,
    onChange,
}: {
    value: number;
    onChange: (days: number) => void;
}) {
    return (
        <div className="flex items-center gap-3 mb-2">
            <span
                className="text-xs whitespace-nowrap"
                style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
            >
                Threshold
            </span>
            <input
                type="range"
                min={3}
                max={30}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value, 10))}
                className="flex-1 h-1 rounded-full appearance-none"
                style={{ accentColor: 'var(--ws-color-warning, #B89B5E)' }}
            />
            <span
                className="text-xs tabular-nums w-8 text-right"
                style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
            >
                {value}d
            </span>
        </div>
    );
}

function StaleProjectList({ projects }: { projects: StaleProjectInfo[] }) {
    const sorted = useMemo(
        () => [...projects].sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate),
        [projects],
    );

    return (
        <ul className="space-y-0.5">
            {sorted.map((p) => (
                <li key={p.projectId} className="flex items-baseline justify-between text-xs">
                    <span
                        className="truncate mr-2"
                        style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
                    >
                        {p.projectName}
                    </span>
                    <span
                        className="tabular-nums whitespace-nowrap"
                        style={{ color: 'var(--ws-color-warning, #B89B5E)' }}
                    >
                        {p.daysSinceUpdate}d ago
                    </span>
                </li>
            ))}
        </ul>
    );
}

function EmailDecayList({ projects }: { projects: EmailDecayInfo[] }) {
    return (
        <ul className="space-y-0.5">
            {projects.map((p) => (
                <li key={p.projectId} className="text-xs">
                    <span style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
                        {p.suggestedAction ?? `${p.daysSinceEmail ?? '?'}d since last email`}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function BackfeedList({ matches }: { matches: BackfeedMatch[] }) {
    const matched = matches.filter((m) => m.matchedProjectId);

    return (
        <ul className="space-y-0.5">
            {matched.map((m, i) => (
                <li key={m.matchedProjectId ?? i} className="flex items-baseline justify-between text-xs">
                    <span
                        className="truncate mr-2"
                        style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
                    >
                        {m.projectName ?? m.clientName ?? 'Unknown'}
                    </span>
                    <span
                        className="tabular-nums whitespace-nowrap"
                        style={{ color: 'var(--ws-accent, #3F5C6E)' }}
                    >
                        {m.matchScore}%
                    </span>
                </li>
            ))}
        </ul>
    );
}

export default ContextSummaryPanel;
