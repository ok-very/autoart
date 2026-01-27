/**
 * NarrativeThreadPanel
 *
 * Event timeline view for the inspector showing the narrative thread
 * of an action - what happened, when, and in what order.
 *
 * Shows events in reverse chronological order (newest first) with
 * major events having larger dots and icons.
 */

import { clsx } from 'clsx';
import { Clock, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Badge } from '@autoart/ui';

import type { Event } from '@autoart/shared';
import { useActionEvents } from '../../api/hooks';
import { getEventFormatter } from '../projectLog/eventFormatters';

export interface NarrativeThreadPanelProps {
    /** Action ID to show thread for */
    actionId: string | null;
    /** Maximum events to show initially */
    initialLimit?: number;
    /** Additional className */
    className?: string;
}

/**
 * Format relative time
 */
function formatTimeAgo(date: Date): string {
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
}

/**
 * Single event row in the timeline
 */
function EventRow({ event }: { event: Event }) {
    const formatter = getEventFormatter(event.type);
    if (!formatter) return null;
    const Icon = formatter.icon;
    const summary = formatter.summarize((event.payload || {}) as Record<string, unknown>);

    const occurredAt = useMemo(() => {
        const date = event.occurredAt instanceof Date
            ? event.occurredAt
            : new Date(event.occurredAt);
        return {
            relative: formatTimeAgo(date),
            absolute: date.toLocaleString(),
        };
    }, [event.occurredAt]);

    return (
        <div className="flex items-start gap-3 py-2">
            {/* Timeline dot/icon */}
            <div className={clsx(
                'shrink-0 rounded-full flex items-center justify-center mt-0.5',
                formatter.dotBgClass,
                formatter.dotTextClass,
                formatter.isMajor ? 'w-6 h-6' : 'w-3 h-3'
            )}>
                {formatter.isMajor && Icon && <Icon size={12} />}
            </div>

            {/* Event content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={clsx('text-sm font-medium', formatter.labelClass)}>
                        {formatter.label}
                    </span>
                    <span
                        className="text-xs text-slate-400"
                        title={occurredAt.absolute}
                    >
                        {occurredAt.relative}
                    </span>
                </div>
                {summary && (
                    <p className="text-sm text-slate-600 truncate mt-0.5">
                        {summary}
                    </p>
                )}
                {event.actorId && (
                    <p className="text-xs text-slate-400 mt-0.5">
                        by {event.actorId}
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * NarrativeThreadPanel Component
 */
export function NarrativeThreadPanel({
    actionId,
    initialLimit = 10,
    className,
}: NarrativeThreadPanelProps) {
    const [showAll, setShowAll] = useState(false);

    // Fetch events for the action
    const { data: events, isLoading, error } = useActionEvents(actionId);

    // Sort events by date (newest first)
    const sortedEvents = useMemo(() => {
        if (!events) return [];
        return [...events].sort((a, b) => {
            const dateA = a.occurredAt instanceof Date ? a.occurredAt : new Date(a.occurredAt);
            const dateB = b.occurredAt instanceof Date ? b.occurredAt : new Date(b.occurredAt);
            return dateB.getTime() - dateA.getTime();
        });
    }, [events]);

    // Group events by category
    const eventsByCategory = useMemo(() => {
        const groups: Record<string, Event[]> = {};
        for (const event of sortedEvents) {
            const formatter = getEventFormatter(event.type);
            const category = formatter?.category ?? 'other';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(event);
        }
        return groups;
    }, [sortedEvents]);

    // Get visible events
    const visibleEvents = showAll
        ? sortedEvents
        : sortedEvents.slice(0, initialLimit);

    // Empty state
    if (!actionId) {
        return (
            <div className={clsx('text-center py-8 text-slate-400', className)}>
                <Clock size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select an action to view its narrative</p>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center py-8', className)}>
                <RefreshCw size={16} className="animate-spin mr-2 text-slate-400" />
                <span className="text-sm text-slate-400">Loading timeline...</span>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={clsx('text-center py-8 text-red-500', className)}>
                <p className="text-sm">Failed to load timeline</p>
            </div>
        );
    }

    // No events state
    if (sortedEvents.length === 0) {
        return (
            <div className={clsx('text-center py-8 text-slate-400', className)}>
                <Clock size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No events recorded yet</p>
            </div>
        );
    }

    return (
        <div className={clsx('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                    Narrative Thread
                </h3>
                <Badge variant="neutral" size="xs">
                    {sortedEvents.length} events
                </Badge>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[11px] top-4 bottom-4 w-px bg-slate-200" />

                {/* Events list */}
                <div className="space-y-1">
                    {visibleEvents.map((event) => (
                        <EventRow key={event.id} event={event} />
                    ))}
                </div>

                {/* Show more */}
                {sortedEvents.length > initialLimit && (
                    <button
                        type="button"
                        onClick={() => setShowAll(!showAll)}
                        className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                        {showAll ? (
                            <>
                                <ChevronRight size={12} />
                                Show less
                            </>
                        ) : (
                            <>
                                <ChevronDown size={12} />
                                Show {sortedEvents.length - initialLimit} more events
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Category breakdown */}
            {Object.keys(eventsByCategory).length > 1 && (
                <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">By category</p>
                    <div className="flex flex-wrap gap-1.5">
                        {Object.entries(eventsByCategory).map(([category, catEvents]) => (
                            <Badge
                                key={category}
                                variant="neutral"
                                size="xs"
                            >
                                {category}: {catEvents.length}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default NarrativeThreadPanel;
