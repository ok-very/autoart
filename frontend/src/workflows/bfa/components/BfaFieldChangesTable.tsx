/**
 * BfaFieldChangesTable
 *
 * Grouped field-level diff table with decision buttons.
 * Changes are grouped by projectLabel, each group collapsible.
 */

import { useMemo, useState } from 'react';

import type { BfaFieldChange, BfaSyncDecision } from '@autoart/shared';

import { Badge, Button } from '@autoart/ui';

interface BfaFieldChangesTableProps {
    changes: BfaFieldChange[];
    decisions: Map<string, BfaSyncDecision | null>;
    onDecisionChange: (entityId: string, field: string, decision: BfaSyncDecision) => void;
}

/** Build a stable key for a field change */
function changeKey(entityId: string, field: string): string {
    return `${entityId}::${field}`;
}

/** Format a field path for display */
function formatField(field: string): string {
    return field
        .replace(/^fields\./, '')
        .replace(/[._]/g, ' ');
}

const severityBorder: Record<string, string> = {
    info: '',
    warning: 'border-l-2 border-l-[var(--ws-color-warning)]',
    critical: 'border-l-2 border-l-[var(--ws-color-error)]',
};

const severityBg: Record<string, string> = {
    info: '',
    warning: 'bg-[var(--ws-color-warning)]/5',
    critical: 'bg-[var(--ws-color-error)]/5',
};

export function BfaFieldChangesTable({ changes, decisions, onDecisionChange }: BfaFieldChangesTableProps) {
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const grouped = useMemo(() => {
        const groups = new Map<string, BfaFieldChange[]>();
        for (const change of changes) {
            const existing = groups.get(change.projectLabel);
            if (existing) {
                existing.push(change);
            } else {
                groups.set(change.projectLabel, [change]);
            }
        }
        return groups;
    }, [changes]);

    const toggleGroup = (label: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(label)) {
                next.delete(label);
            } else {
                next.add(label);
            }
            return next;
        });
    };

    if (changes.length === 0) {
        return (
            <div className="py-8 text-center text-ws-text-secondary text-sm">
                No field changes detected.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            {Array.from(grouped.entries()).map(([label, groupChanges]) => {
                const isCollapsed = collapsedGroups.has(label);

                return (
                    <div key={label}>
                        <button
                            type="button"
                            onClick={() => toggleGroup(label)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-medium text-ws-fg hover:bg-ws-row-expanded-bg rounded transition-colors"
                        >
                            <span className="text-ws-text-secondary text-xs">
                                {isCollapsed ? '▸' : '▾'}
                            </span>
                            <span>{label}</span>
                            <Badge variant="neutral" size="xs">
                                {groupChanges.length}
                            </Badge>
                        </button>

                        {!isCollapsed && (
                            <div className="ml-2">
                                {/* Header row */}
                                <div className="grid grid-cols-[1fr_2fr_80px_70px_140px] gap-2 px-3 py-1 text-[11px] font-medium text-ws-text-secondary uppercase tracking-wide">
                                    <span>Field</span>
                                    <span>Old → New</span>
                                    <span>Authority</span>
                                    <span>Severity</span>
                                    <span>Decision</span>
                                </div>

                                {groupChanges.map((change) => {
                                    const key = changeKey(change.entityId, change.field);
                                    const currentDecision = decisions.get(key) ?? null;

                                    return (
                                        <div
                                            key={key}
                                            className={`grid grid-cols-[1fr_2fr_80px_70px_140px] gap-2 px-3 py-1.5 items-center text-sm ${severityBorder[change.severity]} ${severityBg[change.severity]}`}
                                        >
                                            <span className="text-ws-fg truncate" title={change.field}>
                                                {formatField(change.field)}
                                            </span>

                                            <span className="text-ws-fg text-xs overflow-hidden">
                                                <span className="line-through text-ws-text-secondary">
                                                    {change.oldValue || '(empty)'}
                                                </span>
                                                <span className="mx-1 text-ws-text-disabled">→</span>
                                                <span className="font-medium">
                                                    {change.newValue || '(empty)'}
                                                </span>
                                            </span>

                                            <AuthorityBadge authority={change.authority} />
                                            <SeverityBadge severity={change.severity} />

                                            <DecisionButtons
                                                current={currentDecision}
                                                authority={change.authority}
                                                onChange={(d) => onDecisionChange(change.entityId, change.field, d)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function AuthorityBadge({ authority }: { authority: string }) {
    if (authority === 'monday') {
        return <Badge variant="light" size="xs">monday</Badge>;
    }
    return <Badge variant="warning" size="xs">merge</Badge>;
}

function SeverityBadge({ severity }: { severity: string }) {
    const variant = severity === 'critical' ? 'error' : severity === 'warning' ? 'warning' : 'neutral';
    return <Badge variant={variant} size="xs">{severity}</Badge>;
}

function DecisionButtons({ current, authority, onChange }: {
    current: BfaSyncDecision | null;
    authority: string;
    onChange: (decision: BfaSyncDecision) => void;
}) {
    // Monday-authority changes are auto-accepted; show as read-only
    if (authority === 'monday') {
        return (
            <span className="text-xs text-ws-text-secondary italic">
                auto
            </span>
        );
    }

    return (
        <div className="flex gap-0.5">
            <Button
                size="xs"
                variant={current === 'accept' ? 'light' : 'ghost'}
                color={current === 'accept' ? 'green' : 'gray'}
                onClick={() => onChange('accept')}
            >
                ✓
            </Button>
            <Button
                size="xs"
                variant={current === 'reject' ? 'light' : 'ghost'}
                color={current === 'reject' ? 'red' : 'gray'}
                onClick={() => onChange('reject')}
            >
                ✗
            </Button>
            <Button
                size="xs"
                variant={current === 'defer' ? 'light' : 'ghost'}
                color={current === 'defer' ? 'yellow' : 'gray'}
                onClick={() => onChange('defer')}
            >
                …
            </Button>
        </div>
    );
}
