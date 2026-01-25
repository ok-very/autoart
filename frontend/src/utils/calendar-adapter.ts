/**
 * Calendar Adapter
 *
 * Converts actions to react-big-calendar event format.
 * Handles date extraction, duration-based inference, and metadata mapping.
 */

import type { ActionProjectionInput } from '@autoart/shared';
import { computeScheduledDates, extractTitle } from '@autoart/shared';

/**
 * Calendar event format compatible with react-big-calendar
 */
export interface CalendarEvent {
    /** Action ID for reference */
    actionId: string;
    /** Display title */
    title: string;
    /** Event start date */
    start: Date;
    /** Event end date */
    end: Date;
    /** Whether this is an all-day event */
    allDay?: boolean;
    /** Additional metadata for rendering and callbacks */
    metadata?: {
        type?: string;
        status?: string;
        assignee?: string;
        isStartInferred?: boolean;
        isDueInferred?: boolean;
        [key: string]: unknown;
    };
}

/**
 * Convert an array of actions to calendar events.
 *
 * Actions without date information are filtered out.
 * Duration-based date inference is supported via computeScheduledDates.
 *
 * @param actions - Actions to convert
 * @param useWorkingDays - Whether to use working days for duration calculations
 * @returns Array of calendar events
 */
export function actionsToCalendarEvents(
    actions: ActionProjectionInput[],
    useWorkingDays = false
): CalendarEvent[] {
    return actions
        .map(action => {
            const { startDate, dueDate, isStartInferred, isDueInferred } = computeScheduledDates(action, useWorkingDays);

            // Skip actions without any date information
            if (!startDate && !dueDate) {
                return null;
            }

            // For events with only one date, use it for both start and end
            // Use nullish coalescing - at this point at least one is defined
            const effectiveStartDate = startDate ?? dueDate;
            const effectiveDueDate = dueDate ?? startDate;

            // Defensive check in case guard logic is refactored
            if (!effectiveStartDate || !effectiveDueDate) {
                return null;
            }

            const start = new Date(effectiveStartDate);
            const end = new Date(effectiveDueDate);

            // Validate dates - skip if invalid
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return null;
            }

            // Ensure end is not before start
            const adjustedEnd = end >= start ? end : new Date(start);

            const event: CalendarEvent = {
                actionId: action.id,
                title: extractTitle(action),
                start,
                end: adjustedEnd,
                allDay: true,
                metadata: {
                    // Spread raw metadata first, then override with explicitly extracted values
                    ...action.metadata,
                    type: action.type,
                    status: action.metadata?.status as string | undefined,
                    assignee: action.metadata?.assignee as string | undefined,
                    isStartInferred,
                    isDueInferred,
                },
            };
            return event;
        })
        .filter((e): e is CalendarEvent => e !== null);
}

/**
 * Calculate duration in days between two dates.
 *
 * @param start - Start date
 * @param end - End date
 * @param useWorkingDays - Whether to count only working days
 * @returns Number of days (minimum 1), or null if dates are invalid/reversed
 */
export function calculateDurationDays(
    start: Date,
    end: Date,
    useWorkingDays = false
): number | null {
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return null;
    }

    // Check for reversed date range
    if (end < start) {
        return null;
    }

    if (!useWorkingDays) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
    }

    // Count working days
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return Math.max(1, count);
}

/**
 * Get color for an event based on status or type.
 *
 * @param event - Calendar event
 * @returns CSS color value
 */
export function getEventColor(event: CalendarEvent): string {
    const status = event.metadata?.status;

    switch (status) {
        case 'completed':
        case 'done':
        case 'finished':
            return '#22c55e'; // green-500
        case 'in_progress':
        case 'active':
            return '#3b82f6'; // blue-500
        case 'blocked':
            return '#ef4444'; // red-500
        case 'pending':
        default:
            return '#6366f1'; // indigo-500
    }
}
