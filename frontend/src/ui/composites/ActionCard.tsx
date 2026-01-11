/**
 * ActionCard - Display card for a single action
 *
 * Split card layout matching the implementation plan:
 * - Top half: Mutable intent (ACTION badge, field bindings, affordances)
 * - Divider
 * - Bottom half: Immutable events emitted
 *
 * Used in ActionsList for the action log view.
 */

import { ChevronDown, XCircle, PencilLine } from 'lucide-react';
import { useState, useMemo } from 'react';

import type { Action, Event } from '@autoart/shared';

import { EventRow } from '../primitives/EventRow';


// ==================== TYPES ====================

export interface ActionCardProps {
    action: Action;
    events: Event[];
    /** Whether to show system events */
    includeSystemEvents?: boolean;
    /** Callback when action is clicked for inspection */
    onClick?: () => void;
    /** Callback to retract action */
    onRetract?: () => void;
    /** Callback to amend bindings */
    onAmend?: () => void;
}

// ==================== HELPERS ====================

function formatTimestamp(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getActionTitle(action: Action): string {
    const bindings = action.fieldBindings || [];
    const titleBinding = bindings.find((b: { fieldKey: string; value?: unknown }) => b.fieldKey === 'title');
    if (titleBinding?.value && typeof titleBinding.value === 'string') {
        return titleBinding.value;
    }
    return `${action.type} ${action.id.slice(0, 8)}`;
}

/**
 * Format a field value for display - quotes strings, @mentions for assignees
 */
function formatBindingValue(key: string, value: unknown): JSX.Element {
    if (value === null || value === undefined) {
        return <span className="text-slate-400 italic">—</span>;
    }

    // Handle user/assignee mentions
    if ((key === 'assignee' || key === 'owner' || key === 'user') && typeof value === 'string') {
        return <span className="text-indigo-600 font-medium">@{value.replace('@', '')}</span>;
    }

    // Handle dates
    if (key.toLowerCase().includes('date') && typeof value === 'string') {
        return <span className="text-slate-700">{value}</span>;
    }

    // Handle strings with quotes
    if (typeof value === 'string') {
        return <span className="font-semibold text-slate-800">"{value}"</span>;
    }

    // Handle other types
    return <span className="text-slate-700">{JSON.stringify(value)}</span>;
}

// ==================== COMPONENT ====================

export function ActionCard({
    action,
    events,
    includeSystemEvents = false,
    onClick,
    onRetract,
    onAmend,
}: ActionCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [eventsExpanded, setEventsExpanded] = useState(true);

    // Filter visible events
    const visibleEvents = useMemo(() => {
        if (includeSystemEvents) return events;
        // Filter out system events (events without actionId or with system prefix)
        return events.filter((e) => {
            const isSystem = e.type.startsWith('SYSTEM_') || e.type === 'ACTION_DECLARED';
            return !isSystem;
        });
    }, [events, includeSystemEvents]);

    // All field bindings for display (now including title)
    const displayBindings = useMemo(() => {
        return action.fieldBindings || [];
    }, [action.fieldBindings]);

    return (
        <div
            className="inspector-card bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
            onClick={onClick}
        >
            {/* TOP: MUTABLE INTENT */}
            <div className="card-intent p-4 bg-white">
                {/* Header row */}
                <div className="flex justify-between items-start mb-2">
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        <ChevronDown
                            size={14}
                            className={`text-slate-400 transition-transform ${!isExpanded ? '-rotate-90' : ''}`}
                        />
                        <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            ACTION: {action.type}
                        </span>
                        <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                            {getActionTitle(action)}
                        </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                        {action.id.slice(0, 12)} • Manual • {formatTimestamp(action.createdAt)}
                    </div>
                </div>

                {/* Expandable content */}
                {isExpanded && (
                    <>
                        {/* Field Bindings */}
                        <div className="pl-6 mb-4">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">
                                Field Bindings
                            </div>
                            {displayBindings.length > 0 ? (
                                <div className="space-y-1 text-xs font-mono text-slate-600">
                                    {displayBindings.map((binding: { fieldKey: string; value?: unknown }) => (
                                        <div key={binding.fieldKey} className="flex gap-2">
                                            <span className="text-slate-400 w-20 text-right">{binding.fieldKey} →</span>
                                            {formatBindingValue(binding.fieldKey, binding.value)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic">No additional bindings</div>
                            )}
                        </div>

                        {/* Mutation Affordances */}
                        <div className="pl-6 flex gap-3">
                            {onRetract && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRetract();
                                    }}
                                    className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                                >
                                    <XCircle size={12} /> Retract
                                </button>
                            )}
                            {onAmend && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAmend();
                                    }}
                                    className="text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                                >
                                    <PencilLine size={12} /> Amend
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* DIVIDER */}
            <div className="card-divider h-px bg-slate-200" />

            {/* BOTTOM: IMMUTABLE EVENTS */}
            <div className="card-events bg-slate-50 p-3 text-xs">
                <div
                    className="flex items-center gap-2 mb-3 cursor-pointer text-slate-500 hover:text-slate-700"
                    onClick={(e) => {
                        e.stopPropagation();
                        setEventsExpanded(!eventsExpanded);
                    }}
                >
                    <ChevronDown
                        size={12}
                        className={`transition-transform ${!eventsExpanded ? '-rotate-90' : ''}`}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                        Events emitted ({visibleEvents.length})
                    </span>
                </div>

                {eventsExpanded && (
                    <div className="space-y-1">
                        {visibleEvents.length > 0 ? (
                            visibleEvents.map((event) => (
                                <EventRow
                                    key={event.id}
                                    event={event}
                                    isSystem={event.type.startsWith('SYSTEM_')}
                                />
                            ))
                        ) : (
                            <div className="text-xs text-slate-400 italic py-2 text-center">
                                No events emitted
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
