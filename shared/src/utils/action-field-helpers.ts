/**
 * Action Field Helpers
 *
 * Pure utility functions for extracting field values from Actions.
 * Used by projections and renderers to derive display data from
 * field_bindings and event streams.
 */

import type { ActionProjectionInput } from '../projections.js';
import type { ScheduleMode } from '../schemas/actions.js';

// ============================================================================
// FIELD EXTRACTION
// ============================================================================

/**
 * Extract a field value from an action's field_bindings.
 * Returns undefined if not found.
 */
export function extractFieldValue(
    action: ActionProjectionInput,
    fieldKey: string
): unknown {
    const binding = action.field_bindings?.find(
        (fb) => fb.fieldKey === fieldKey || fb.fieldKey.toLowerCase() === fieldKey.toLowerCase()
    );
    return binding?.value;
}

/**
 * Extract the title/name of an action.
 * Priority: field_bindings.title > field_bindings.name > metadata.title > action.type
 */
export function extractTitle(action: ActionProjectionInput): string {
    // Check field bindings first
    const titleValue = extractFieldValue(action, 'title') ?? extractFieldValue(action, 'name');
    if (typeof titleValue === 'string' && titleValue.trim()) {
        return titleValue.trim();
    }

    // Check metadata
    if (action.metadata?.title && typeof action.metadata.title === 'string') {
        return action.metadata.title;
    }
    if (action.metadata?.name && typeof action.metadata.name === 'string') {
        return action.metadata.name;
    }

    // Fallback to action type
    return action.type || 'Untitled';
}

/**
 * Extract start date from an action.
 * Checks field_bindings for startDate, start_date, or event-derived dates.
 */
export function extractStartDate(action: ActionProjectionInput): string | null {
    // Check field bindings
    const startDate = extractFieldValue(action, 'startDate')
        ?? extractFieldValue(action, 'start_date')
        ?? extractFieldValue(action, 'start');

    if (startDate && typeof startDate === 'string') {
        return normalizeDate(startDate);
    }

    // Check metadata (imported values)
    if (action.metadata?.startDate && typeof action.metadata.startDate === 'string') {
        return normalizeDate(action.metadata.startDate);
    }

    // Event-derived: earliest WORK_STARTED or ACTION_CREATED
    const relevantEvents = action.events?.filter(e =>
        e.event_type === 'ACTION_CREATED' || e.event_type === 'WORK_STARTED'
    ) ?? [];
    if (relevantEvents.length > 0) {
        const earliest = relevantEvents.reduce((a, b) =>
            new Date(a.occurred_at).getTime() < new Date(b.occurred_at).getTime() ? a : b
        );
        return normalizeDate(earliest.occurred_at);
    }

    return null;
}

/**
 * Extract due/end date from an action.
 * Checks field_bindings for dueDate, due_date, endDate, or event-derived dates.
 */
export function extractDueDate(action: ActionProjectionInput): string | null {
    // Check field bindings
    const dueDate = extractFieldValue(action, 'dueDate')
        ?? extractFieldValue(action, 'due_date')
        ?? extractFieldValue(action, 'endDate')
        ?? extractFieldValue(action, 'end_date')
        ?? extractFieldValue(action, 'due')
        ?? extractFieldValue(action, 'end');

    if (dueDate && typeof dueDate === 'string') {
        return normalizeDate(dueDate);
    }

    // Check metadata (imported values)
    if (action.metadata?.dueDate && typeof action.metadata.dueDate === 'string') {
        return normalizeDate(action.metadata.dueDate);
    }
    if (action.metadata?.endDate && typeof action.metadata.endDate === 'string') {
        return normalizeDate(action.metadata.endDate);
    }

    // Event-derived: WORK_FINISHED
    const finishedEvent = action.events?.find(e => e.event_type === 'WORK_FINISHED');
    if (finishedEvent?.occurred_at) {
        return normalizeDate(finishedEvent.occurred_at);
    }

    return null;
}

/**
 * Extract duration in days from an action.
 * Checks field_bindings for durationDays, duration_days, or duration.
 */
export function extractDurationDays(action: ActionProjectionInput): number | null {
    const duration = extractFieldValue(action, 'durationDays')
        ?? extractFieldValue(action, 'duration_days')
        ?? extractFieldValue(action, 'duration');
    return typeof duration === 'number' && duration >= 0 ? Math.floor(duration) : null;
}

/**
 * Extract schedule mode from an action.
 * Determines how dates are computed from duration.
 */
export function extractScheduleMode(action: ActionProjectionInput): ScheduleMode | null {
    const mode = extractFieldValue(action, 'scheduleMode')
        ?? extractFieldValue(action, 'schedule_mode');
    if (mode === 'explicit' || mode === 'anchor_start' || mode === 'anchor_due') {
        return mode;
    }
    return null;
}

/**
 * Computed dates result from schedule computation.
 */
export interface ComputedDates {
    startDate: string | null;
    dueDate: string | null;
    isStartInferred: boolean;
    isDueInferred: boolean;
}

/**
 * Compute scheduled dates from an action, using duration and schedule mode.
 * Supports both calendar days and working days (skipping weekends).
 */
export function computeScheduledDates(
    action: ActionProjectionInput,
    useWorkingDays = false
): ComputedDates {
    const explicitStart = extractStartDate(action);
    const explicitDue = extractDueDate(action);
    const duration = extractDurationDays(action);
    const mode = extractScheduleMode(action) ?? 'explicit';

    if (mode === 'explicit' || duration === null) {
        return { startDate: explicitStart, dueDate: explicitDue, isStartInferred: false, isDueInferred: false };
    }

    if (mode === 'anchor_start' && explicitStart) {
        const computed = addDays(new Date(explicitStart), duration, useWorkingDays);
        return { startDate: explicitStart, dueDate: computed.toISOString(), isStartInferred: false, isDueInferred: true };
    }

    if (mode === 'anchor_due' && explicitDue) {
        const computed = subtractDays(new Date(explicitDue), duration, useWorkingDays);
        return { startDate: computed.toISOString(), dueDate: explicitDue, isStartInferred: true, isDueInferred: false };
    }

    return { startDate: explicitStart, dueDate: explicitDue, isStartInferred: false, isDueInferred: false };
}

/**
 * Add days to a date, optionally skipping weekends.
 */
function addDays(date: Date, days: number, useWorkingDays: boolean): Date {
    const result = new Date(date);
    if (!useWorkingDays) {
        result.setDate(result.getDate() + days);
        return result;
    }
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) added++;
    }
    return result;
}

/**
 * Subtract days from a date, optionally skipping weekends.
 */
function subtractDays(date: Date, days: number, useWorkingDays: boolean): Date {
    const result = new Date(date);
    if (!useWorkingDays) {
        result.setDate(result.getDate() - days);
        return result;
    }
    let subtracted = 0;
    while (subtracted < days) {
        result.setDate(result.getDate() - 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) subtracted++;
    }
    return result;
}

/**
 * Extract status from an action.
 */
export function extractStatus(action: ActionProjectionInput): string | null {
    const status = extractFieldValue(action, 'status');
    if (typeof status === 'string') {
        return status;
    }

    // Event-derived status
    const hasFinished = action.events?.some(e => e.event_type === 'WORK_FINISHED');
    const hasStarted = action.events?.some(e => e.event_type === 'WORK_STARTED');

    if (hasFinished) return 'completed';
    if (hasStarted) return 'in_progress';
    return null;
}

/**
 * Extract assignee/owner from an action.
 */
export function extractAssignee(action: ActionProjectionInput): string | null {
    const assignee = extractFieldValue(action, 'assignee')
        ?? extractFieldValue(action, 'owner')
        ?? extractFieldValue(action, 'assigned_to');

    if (typeof assignee === 'string') {
        return assignee;
    }
    return null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize a date string to ISO format.
 * Handles various input formats.
 */
function normalizeDate(dateStr: string): string | null {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return null;
        }
        return date.toISOString();
    } catch {
        return null;
    }
}
