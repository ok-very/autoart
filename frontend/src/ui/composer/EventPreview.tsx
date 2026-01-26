/**
 * EventPreview
 *
 * Shows what events will be emitted when an action is created.
 * This is the key differentiator in the narrative canvas - users see
 * the consequences of their declarations before committing.
 *
 * Uses the existing eventFormatters pattern for consistent styling.
 */

import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useState, useMemo } from 'react';

import { getEventFormatter } from '../projectLog/eventFormatters';

export interface PendingEvent {
    type: string;
    payload?: Record<string, unknown>;
}

export interface EventPreviewProps {
    /** Events that will be emitted */
    events: PendingEvent[];
    /** Whether the preview is expanded */
    expanded?: boolean;
    /** Toggle expanded state */
    onToggleExpanded?: () => void;
    /** Max events to show when collapsed */
    collapsedLimit?: number;
    /** Size variant */
    size?: 'sm' | 'md';
    /** Additional className */
    className?: string;
}

/**
 * Build a list of pending events based on composer form state
 */
export function buildPendingEvents(options: {
    actionType: string;
    title?: string;
    description?: string;
    fieldValues?: Array<{ key: string; value: unknown }>;
    references?: Array<{ recordName: string; targetFieldKey: string }>;
}): PendingEvent[] {
    const events: PendingEvent[] = [];
    const { actionType, title, description, fieldValues, references } = options;

    // ACTION_DECLARED is always first
    events.push({
        type: 'ACTION_DECLARED',
        payload: {
            type: actionType,
            title: title || undefined,
        },
    });

    // FIELD_VALUE_RECORDED for title
    if (title) {
        events.push({
            type: 'FIELD_VALUE_RECORDED',
            payload: {
                field_key: 'title',
                value: title,
            },
        });
    }

    // FIELD_VALUE_RECORDED for description
    if (description) {
        events.push({
            type: 'FIELD_VALUE_RECORDED',
            payload: {
                field_key: 'description',
                value: description,
            },
        });
    }

    // FIELD_VALUE_RECORDED for other fields
    if (fieldValues) {
        for (const field of fieldValues) {
            if (field.value !== undefined && field.value !== '') {
                events.push({
                    type: 'FIELD_VALUE_RECORDED',
                    payload: {
                        field_key: field.key,
                        value: field.value,
                    },
                });
            }
        }
    }

    // ACTION_REFERENCE_ADDED for references
    if (references) {
        for (const ref of references) {
            events.push({
                type: 'ACTION_REFERENCE_ADDED',
                payload: {
                    record_name: ref.recordName,
                    target_field_key: ref.targetFieldKey,
                },
            });
        }
    }

    return events;
}

/**
 * Single event row in the preview
 */
function EventRow({
    event,
    size = 'sm',
}: {
    event: PendingEvent;
    size?: 'sm' | 'md';
}) {
    const formatter = getEventFormatter(event.type);
    const summary = formatter.summarize(event.payload || {});
    const Icon = formatter.icon;

    return (
        <div className={clsx(
            'flex items-center gap-2',
            size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
            {/* Dot indicator */}
            <div className={clsx(
                'shrink-0 rounded-full flex items-center justify-center',
                formatter.dotBgClass,
                formatter.dotTextClass,
                formatter.isMajor ? 'w-5 h-5' : 'w-3 h-3'
            )}>
                {formatter.isMajor && <Icon size={size === 'sm' ? 10 : 12} />}
            </div>

            {/* Event type */}
            <span className={clsx(
                'font-mono font-medium',
                formatter.labelClass,
                size === 'sm' ? 'text-[10px]' : 'text-xs'
            )}>
                {event.type}
            </span>

            {/* Summary */}
            {summary && (
                <span className="text-slate-500 truncate">
                    {summary}
                </span>
            )}
        </div>
    );
}

/**
 * EventPreview Component
 */
export function EventPreview({
    events,
    expanded = false,
    onToggleExpanded,
    collapsedLimit = 2,
    size = 'sm',
    className,
}: EventPreviewProps) {
    const [localExpanded, setLocalExpanded] = useState(expanded);
    const isExpanded = onToggleExpanded ? expanded : localExpanded;
    const toggleExpanded = onToggleExpanded || (() => setLocalExpanded((e) => !e));

    // Determine which events to show
    const visibleEvents = useMemo(() => {
        if (isExpanded || events.length <= collapsedLimit) {
            return events;
        }
        return events.slice(0, collapsedLimit);
    }, [events, isExpanded, collapsedLimit]);

    const hiddenCount = events.length - visibleEvents.length;

    // Don't render if no events
    if (events.length === 0) {
        return null;
    }

    return (
        <div className={clsx(
            'rounded-lg border border-slate-200 bg-slate-50/50',
            size === 'sm' ? 'p-2' : 'p-3',
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-slate-600">
                    <Sparkles size={size === 'sm' ? 12 : 14} className="text-amber-500" />
                    <span className={clsx(
                        'font-medium',
                        size === 'sm' ? 'text-[10px]' : 'text-xs'
                    )}>
                        What will happen
                    </span>
                </div>
                {events.length > collapsedLimit && (
                    <button
                        type="button"
                        onClick={toggleExpanded}
                        className={clsx(
                            'flex items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors',
                            size === 'sm' ? 'text-[10px]' : 'text-xs'
                        )}
                    >
                        {isExpanded ? (
                            <>
                                <span>Less</span>
                                <ChevronUp size={size === 'sm' ? 10 : 12} />
                            </>
                        ) : (
                            <>
                                <span>+{hiddenCount} more</span>
                                <ChevronDown size={size === 'sm' ? 10 : 12} />
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Event list */}
            <div className={clsx(
                'space-y-1.5',
                size === 'sm' ? 'pl-1' : 'pl-2'
            )}>
                {visibleEvents.map((event, idx) => (
                    <EventRow key={`${event.type}-${idx}`} event={event} size={size} />
                ))}
            </div>
        </div>
    );
}

export default EventPreview;
