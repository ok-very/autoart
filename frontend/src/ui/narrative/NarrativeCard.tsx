/**
 * NarrativeCard
 *
 * Single entry in the narrative stream showing an action/entity with its
 * event timeline. This is the atomic unit of the narrative view.
 *
 * Shows:
 * - Action title and status
 * - Event timeline (what happened)
 * - Cross-entity links (emails, records, etc.)
 * - Pending events (what will happen next)
 */

import { clsx } from 'clsx';
import {
    CheckCircle,
    Circle,
    AlertTriangle,
    Play,
    ChevronDown,
    ChevronRight,
    Link2,
    Mail,
    FileText,
    Target,
} from 'lucide-react';
import { useState, useMemo } from 'react';

import { Badge } from '@autoart/ui';

import type { DerivedStatus } from '@autoart/shared';
import { getEventFormatter } from '../projectLog/eventFormatters';

export interface NarrativeEvent {
    id: string;
    type: string;
    payload?: Record<string, unknown>;
    occurredAt: string;
    actor?: string;
}

export interface LinkedEntity {
    id: string;
    type: 'email' | 'record' | 'action' | 'document';
    title: string;
    status?: 'synced' | 'drift' | 'broken';
}

export interface NarrativeCardProps {
    /** Action ID */
    id: string;
    /** Action title */
    title: string;
    /** Action type (e.g., "Task", "Subtask") */
    type: string;
    /** Current status */
    status: DerivedStatus;
    /** Events that have occurred */
    events?: NarrativeEvent[];
    /** Linked entities (emails, records, etc.) */
    linkedEntities?: LinkedEntity[];
    /** Whether this card is selected */
    selected?: boolean;
    /** Whether to show events expanded */
    showEvents?: boolean;
    /** Callback when card is clicked */
    onClick?: () => void;
    /** Additional className */
    className?: string;
}

/**
 * Status badge configuration
 * Uses DerivedStatus values: pending, active, blocked, finished
 */
const statusConfig: Record<DerivedStatus, {
    label: string;
    icon: typeof CheckCircle;
    colorClass: string;
    badgeVariant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}> = {
    pending: {
        label: 'Pending',
        icon: Circle,
        colorClass: 'text-slate-400',
        badgeVariant: 'neutral',
    },
    active: {
        label: 'Active',
        icon: Play,
        colorClass: 'text-blue-500',
        badgeVariant: 'info',
    },
    finished: {
        label: 'Done',
        icon: CheckCircle,
        colorClass: 'text-green-500',
        badgeVariant: 'success',
    },
    blocked: {
        label: 'Blocked',
        icon: AlertTriangle,
        colorClass: 'text-red-500',
        badgeVariant: 'error',
    },
};

/**
 * Entity type icon mapping
 */
const entityIcons: Record<LinkedEntity['type'], typeof Mail> = {
    email: Mail,
    record: FileText,
    action: Target,
    document: FileText,
};

/**
 * Single event row within the card
 */
function EventRow({ event }: { event: NarrativeEvent }) {
    const formatter = getEventFormatter(event.type);
    const summary = formatter.summarize(event.payload || {});
    const Icon = formatter.icon;

    const timeAgo = useMemo(() => {
        const date = new Date(event.occurredAt);

        // Guard against invalid dates
        if (isNaN(date.getTime())) {
            return 'unknown';
        }

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();

        // Guard against future timestamps
        if (diffMs < 0) {
            return 'in the future';
        }

        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }, [event.occurredAt]);

    return (
        <div className="flex items-start gap-2 text-xs">
            {/* Timeline dot */}
            <div className={clsx(
                'shrink-0 rounded-full flex items-center justify-center mt-0.5',
                formatter.dotBgClass,
                formatter.dotTextClass,
                formatter.isMajor ? 'w-4 h-4' : 'w-2 h-2'
            )}>
                {formatter.isMajor && <Icon size={10} />}
            </div>

            {/* Event content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className={clsx('font-medium', formatter.labelClass)}>
                        {formatter.label}
                    </span>
                    <span className="text-slate-400">{timeAgo}</span>
                </div>
                {summary && (
                    <p className="text-slate-500 truncate">{summary}</p>
                )}
            </div>
        </div>
    );
}

/**
 * Linked entity badge
 */
function LinkedEntityBadge({ entity }: { entity: LinkedEntity }) {
    const Icon = entityIcons[entity.type];
    const statusIndicator = entity.status && entity.status !== 'synced' && (
        <span className={clsx(
            'w-1.5 h-1.5 rounded-full',
            entity.status === 'drift' && 'bg-amber-400',
            entity.status === 'broken' && 'bg-red-400'
        )} />
    );

    return (
        <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded transition-colors"
        >
            <Icon size={10} className="text-slate-500" />
            <span className="truncate max-w-[80px]">{entity.title}</span>
            {statusIndicator}
        </button>
    );
}

/**
 * NarrativeCard Component
 */
export function NarrativeCard({
    id: _id,
    title,
    type,
    status,
    events = [],
    linkedEntities = [],
    selected = false,
    showEvents: initialShowEvents = false,
    onClick,
    className,
}: NarrativeCardProps) {
    const [showEvents, setShowEvents] = useState(initialShowEvents);

    const statusInfo = statusConfig[status] || statusConfig.pending;
    const StatusIcon = statusInfo.icon;

    // Sort events by date (most recent first for display)
    const sortedEvents = useMemo(() => {
        return [...events].sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );
    }, [events]);

    return (
        <div
            className={clsx(
                'rounded-lg border bg-white transition-all duration-150',
                selected
                    ? 'border-blue-400 ring-2 ring-blue-100 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
                onClick && 'cursor-pointer',
                className
            )}
            onClick={onClick}
        >
            {/* Header */}
            <div className="px-3 py-2 flex items-start gap-2">
                {/* Status Icon */}
                <div className={clsx('shrink-0 mt-0.5', statusInfo.colorClass)}>
                    <StatusIcon size={16} />
                </div>

                {/* Title & Meta */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm text-slate-900 truncate">
                            {title}
                        </h4>
                        <Badge variant={statusInfo.badgeVariant} size="xs">
                            {statusInfo.label}
                        </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {type}
                    </p>
                </div>

                {/* Expand/Collapse Events */}
                {events.length > 0 && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowEvents((s) => !s);
                        }}
                        className="shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        {showEvents ? (
                            <ChevronDown size={14} />
                        ) : (
                            <ChevronRight size={14} />
                        )}
                    </button>
                )}
            </div>

            {/* Event Timeline (collapsible) */}
            {showEvents && events.length > 0 && (
                <div className="px-3 pb-2 border-t border-slate-100 pt-2">
                    <div className="space-y-2">
                        {sortedEvents.slice(0, 5).map((event) => (
                            <EventRow key={event.id} event={event} />
                        ))}
                        {sortedEvents.length > 5 && (
                            <p className="text-xs text-slate-400 pl-4">
                                +{sortedEvents.length - 5} more events
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Linked Entities */}
            {linkedEntities.length > 0 && (
                <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
                    <Link2 size={10} className="text-slate-400 mr-1" />
                    {linkedEntities.slice(0, 3).map((entity) => (
                        <LinkedEntityBadge key={entity.id} entity={entity} />
                    ))}
                    {linkedEntities.length > 3 && (
                        <span className="text-[10px] text-slate-400">
                            +{linkedEntities.length - 3}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export default NarrativeCard;
