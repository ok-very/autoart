/**
 * FactFamilyGroup
 *
 * Groups facts by the 7 canonical families defined in domain-events.ts:
 * 1. Communication (INFORMATION_SENT)
 * 2. Artifacts (DOCUMENT_PREPARED, DOCUMENT_SUBMITTED)
 * 3. Meetings (MEETING_SCHEDULED, MEETING_HELD, MEETING_CANCELLED)
 * 4. Decisions (DECISION_RECORDED)
 * 5. Financial (INVOICE_PREPARED, PAYMENT_RECORDED)
 * 6. Contracts (CONTRACT_EXECUTED)
 * 7. Process (PROCESS_INITIATED, PROCESS_COMPLETED)
 *
 * Uses the renderFact function from shared for narrative display.
 */

import { clsx } from 'clsx';
import {
    MessageSquare,
    FileText,
    Calendar,
    CheckSquare,
    DollarSign,
    FileSignature,
    Workflow,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { useState, useMemo } from 'react';

import { Badge } from '@autoart/ui';

import {
    KnownFactKind,
    renderFact,
    type BaseFactPayload,
} from '@autoart/shared';

export type FactFamily =
    | 'communication'
    | 'artifacts'
    | 'meetings'
    | 'decisions'
    | 'financial'
    | 'contracts'
    | 'process';

export interface FactEntry {
    id: string;
    factKind: string;
    payload: BaseFactPayload;
    occurredAt: string;
    actionId?: string;
    actionTitle?: string;
}

export interface FactFamilyGroupProps {
    /** The family this group represents */
    family: FactFamily;
    /** Facts in this family */
    facts: FactEntry[];
    /** Whether the group is collapsed */
    collapsed?: boolean;
    /** Callback when a fact is clicked */
    onFactClick?: (fact: FactEntry) => void;
    /** Additional className */
    className?: string;
}

/**
 * Family configuration - icon, color, label, and which fact kinds belong
 */
const familyConfig: Record<FactFamily, {
    label: string;
    icon: typeof MessageSquare;
    colorClass: string;
    bgClass: string;
    borderClass: string;
    factKinds: string[];
}> = {
    communication: {
        label: 'Communication',
        icon: MessageSquare,
        colorClass: 'text-blue-600',
        bgClass: 'bg-blue-50',
        borderClass: 'border-blue-200',
        factKinds: [KnownFactKind.INFORMATION_SENT],
    },
    artifacts: {
        label: 'Artifacts',
        icon: FileText,
        colorClass: 'text-green-600',
        bgClass: 'bg-green-50',
        borderClass: 'border-green-200',
        factKinds: [KnownFactKind.DOCUMENT_PREPARED, KnownFactKind.DOCUMENT_SUBMITTED],
    },
    meetings: {
        label: 'Meetings',
        icon: Calendar,
        colorClass: 'text-purple-600',
        bgClass: 'bg-purple-50',
        borderClass: 'border-purple-200',
        factKinds: [
            KnownFactKind.MEETING_SCHEDULED,
            KnownFactKind.MEETING_HELD,
            KnownFactKind.MEETING_CANCELLED,
        ],
    },
    decisions: {
        label: 'Decisions',
        icon: CheckSquare,
        colorClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        factKinds: [KnownFactKind.DECISION_RECORDED],
    },
    financial: {
        label: 'Financial',
        icon: DollarSign,
        colorClass: 'text-orange-600',
        bgClass: 'bg-orange-50',
        borderClass: 'border-orange-200',
        factKinds: [KnownFactKind.INVOICE_PREPARED, KnownFactKind.PAYMENT_RECORDED],
    },
    contracts: {
        label: 'Contracts',
        icon: FileSignature,
        colorClass: 'text-indigo-600',
        bgClass: 'bg-indigo-50',
        borderClass: 'border-indigo-200',
        factKinds: [KnownFactKind.CONTRACT_EXECUTED],
    },
    process: {
        label: 'Process',
        icon: Workflow,
        colorClass: 'text-teal-600',
        bgClass: 'bg-teal-50',
        borderClass: 'border-teal-200',
        factKinds: [KnownFactKind.PROCESS_INITIATED, KnownFactKind.PROCESS_COMPLETED],
    },
};

/**
 * Determine which family a fact kind belongs to
 */
export function getFactFamily(factKind: string): FactFamily | null {
    for (const [family, config] of Object.entries(familyConfig)) {
        if (config.factKinds.includes(factKind)) {
            return family as FactFamily;
        }
    }
    return null;
}

/**
 * Group facts by their family
 */
export function groupFactsByFamily(facts: FactEntry[]): Record<FactFamily, FactEntry[]> {
    const groups: Record<FactFamily, FactEntry[]> = {
        communication: [],
        artifacts: [],
        meetings: [],
        decisions: [],
        financial: [],
        contracts: [],
        process: [],
    };

    for (const fact of facts) {
        const family = getFactFamily(fact.factKind);
        if (family) {
            groups[family].push(fact);
        }
    }

    return groups;
}

/**
 * Single fact row within a family group
 */
function FactRow({
    fact,
    onClick,
}: {
    fact: FactEntry;
    onClick?: () => void;
}) {
    // Use shared renderFact for narrative text
    const narrative = useMemo(() => {
        try {
            return renderFact(fact.payload);
        } catch {
            return fact.factKind.replace(/_/g, ' ').toLowerCase();
        }
    }, [fact.payload, fact.factKind]);

    const timeAgo = useMemo(() => {
        const date = new Date(fact.occurredAt);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }, [fact.occurredAt]);

    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx(
                'w-full text-left px-3 py-2 rounded-lg transition-colors',
                'hover:bg-slate-100',
                onClick && 'cursor-pointer'
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-slate-700 flex-1">
                    {narrative}
                </p>
                <span className="text-xs text-slate-400 shrink-0">
                    {timeAgo}
                </span>
            </div>
            {fact.actionTitle && (
                <p className="text-xs text-slate-500 mt-0.5">
                    via {fact.actionTitle}
                </p>
            )}
        </button>
    );
}

/**
 * FactFamilyGroup Component
 */
export function FactFamilyGroup({
    family,
    facts,
    collapsed: initialCollapsed = false,
    onFactClick,
    className,
}: FactFamilyGroupProps) {
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const config = familyConfig[family];
    const Icon = config.icon;

    if (facts.length === 0) {
        return null;
    }

    // Sort facts by date (most recent first)
    const sortedFacts = useMemo(() => {
        return [...facts].sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );
    }, [facts]);

    return (
        <div className={clsx(
            'rounded-lg border',
            config.borderClass,
            config.bgClass,
            className
        )}>
            {/* Header */}
            <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className={clsx(
                    'w-full flex items-center justify-between px-3 py-2',
                    'hover:opacity-80 transition-opacity'
                )}
            >
                <div className="flex items-center gap-2">
                    <Icon size={16} className={config.colorClass} />
                    <span className={clsx('font-medium text-sm', config.colorClass)}>
                        {config.label}
                    </span>
                    <Badge variant="neutral" size="xs">
                        {facts.length}
                    </Badge>
                </div>
                {collapsed ? (
                    <ChevronRight size={14} className="text-slate-400" />
                ) : (
                    <ChevronDown size={14} className="text-slate-400" />
                )}
            </button>

            {/* Fact list */}
            {!collapsed && (
                <div className="border-t border-slate-200/50 bg-white/50 rounded-b-lg">
                    {sortedFacts.map((fact) => (
                        <FactRow
                            key={fact.id}
                            fact={fact}
                            onClick={onFactClick ? () => onFactClick(fact) : undefined}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default FactFamilyGroup;
