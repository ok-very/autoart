/**
 * Timeline Mapper
 *
 * Maps Actions to GanttProjectionOutput for timeline visualization.
 * Implements filtering by status, assignee, date range, and parent.
 *
 * This is the frontend equivalent of TimelineProjection - a pure derivation
 * from Actions to displayable Gantt data.
 */

import type {
    Action,
    ActionProjectionInput,
    TimelineProjectionOutput,
    GanttProjectionOutput,
    GanttLane,
    GanttItem,
    GanttDateTick,
} from '@autoart/shared';
import {
    extractTitle,
    extractStartDate,
    extractDueDate,
    extractStatus,
    extractAssignee,
} from '@autoart/shared';

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface TimelineFilter {
    /** Filter by status values (empty = show all) */
    statuses?: string[];
    /** Filter by assignee IDs (empty = show all) */
    assignees?: string[];
    /**
     * Filter by parent action ID.
     * - undefined (omit key): No parent filter, show all actions
     * - null: Show only root-level actions (no parent)
     * - string: Show only children of specified parent action
     */
    parentActionId?: string | null;
    /** Only show items with dates in this range */
    dateRange?: {
        start?: Date;
        end?: Date;
    };
    /** Search term for title matching */
    search?: string;
    /** Group by field (default: parentActionId) */
    groupBy?: 'parent' | 'status' | 'assignee' | 'type';
}

export interface TimelineMapperOptions {
    /** Width per day in pixels */
    dayWidth?: number;
    /** Height per lane in pixels */
    laneHeight?: number;
    /** Colors by status */
    statusColors?: Record<string, string>;
    /** Default color for items without status */
    defaultColor?: string;
    /** Include empty lanes (groups with no items) */
    includeEmptyLanes?: boolean;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_STATUS_COLORS: Record<string, string> = {
    'not_started': '#94a3b8',  // slate-400
    'pending': '#94a3b8',
    'in_progress': '#3b82f6',  // blue-500
    'active': '#3b82f6',
    'blocked': '#ef4444',      // red-500
    'completed': '#22c55e',    // green-500
    'done': '#22c55e',
    'default': '#6366f1',      // indigo-500
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// ACTION TO PROJECTION INPUT CONVERSION
// ============================================================================

/**
 * Convert Action (from API) to ActionProjectionInput (for projections).
 * This bridges the API response format to the projection input format.
 */
export function actionToProjectionInput(
    action: Action,
    events?: Array<{ id: string; event_type: string; occurred_at: string; payload?: Record<string, unknown> }>
): ActionProjectionInput {
    return {
        id: action.id,
        type: action.type,
        context_type: action.contextType,
        context_id: action.contextId,
        parent_action_id: action.parentActionId,
        field_bindings: action.fieldBindings.map(fb => ({
            fieldKey: fb.fieldKey,
            value: fb.value,
        })),
        metadata: {}, // Could be populated from events or other sources
        events,
    };
}

// ============================================================================
// TIMELINE DERIVATION
// ============================================================================

/**
 * Derive TimelineProjectionOutput from Actions.
 * Pure function - no side effects.
 */
export function deriveTimeline(
    actions: ActionProjectionInput[],
    filter?: TimelineFilter
): TimelineProjectionOutput {
    let filtered = actions;

    // Apply filters
    if (filter) {
        filtered = applyFilters(actions, filter);
    }

    // Map to timeline entries
    const entries = filtered
        .map(action => {
            const startDate = extractStartDate(action);
            const endDate = extractDueDate(action);

            // Skip actions without any date
            if (!startDate && !endDate) {
                return null;
            }

            return {
                id: action.id,
                title: extractTitle(action),
                startDate,
                endDate,
                metadata: {
                    ...action.metadata,
                    // Derived fields override any metadata values
                    type: action.type,
                    context_type: action.context_type,
                    context_id: action.context_id,
                    parent_action_id: action.parent_action_id,
                    status: extractStatus(action),
                    assignee: extractAssignee(action),
                },
            };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

    // Sort by start date
    entries.sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    return { entries };
}

// ============================================================================
// GANTT PROJECTION CONVERSION
// ============================================================================

/**
 * Convert TimelineProjectionOutput to GanttProjectionOutput for rendering.
 * Groups entries into lanes based on groupBy option.
 */
export function timelineToGantt(
    timeline: TimelineProjectionOutput,
    projectId: string,
    options: TimelineMapperOptions = {},
    groupBy: TimelineFilter['groupBy'] = 'parent'
): GanttProjectionOutput {
    const {
        dayWidth = 30,
        laneHeight = 60,
        statusColors = DEFAULT_STATUS_COLORS,
        defaultColor = '#6366f1',
    } = options;

    if (timeline.entries.length === 0) {
        // Return empty but valid projection
        const now = new Date();
        return {
            projectId,
            startDate: now.toISOString(),
            endDate: new Date(now.getTime() + 30 * ONE_DAY_MS).toISOString(),
            totalWidth: 30 * dayWidth,
            totalHeight: laneHeight,
            ticks: generateTicks(now, new Date(now.getTime() + 30 * ONE_DAY_MS), dayWidth),
            lanes: [{
                id: 'empty',
                label: 'No items with dates',
                y: 0,
                height: laneHeight,
                depth: 0,
                items: [],
            }],
        };
    }

    // Calculate date range
    const dates = timeline.entries.flatMap(e => [
        e.startDate ? new Date(e.startDate) : null,
        e.endDate ? new Date(e.endDate) : null,
    ]).filter((d): d is Date => d !== null);

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Pad the range
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);

    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / ONE_DAY_MS);
    const totalWidth = totalDays * dayWidth;

    // Group entries into lanes
    const groups = groupEntries(timeline.entries, groupBy);
    const lanes: GanttLane[] = [];
    let currentY = 0;

    for (const [groupKey, entries] of groups) {
        const items: GanttItem[] = entries.map(entry => {
            let start = entry.startDate ? new Date(entry.startDate) : minDate;
            let end = entry.endDate ? new Date(entry.endDate) : new Date(start.getTime() + ONE_DAY_MS);

            // Swap if dates are reversed
            if (end.getTime() < start.getTime()) {
                [start, end] = [end, start];
            }

            const x = Math.floor((start.getTime() - minDate.getTime()) / ONE_DAY_MS) * dayWidth;
            const width = Math.max(dayWidth, Math.ceil((end.getTime() - start.getTime()) / ONE_DAY_MS) * dayWidth);

            const status = (entry.metadata?.status as string) || 'default';
            const color = statusColors[status] || defaultColor;

            return {
                id: entry.id,
                label: entry.title,
                x,
                y: 10, // Offset within lane
                width,
                height: 40,
                color,
                metadata: entry.metadata,
            };
        });

        lanes.push({
            id: groupKey,
            label: formatGroupLabel(groupKey, groupBy),
            y: currentY,
            height: laneHeight,
            depth: 0,
            items,
        });

        currentY += laneHeight;
    }

    return {
        projectId,
        startDate: minDate.toISOString(),
        endDate: maxDate.toISOString(),
        totalWidth,
        totalHeight: currentY || laneHeight,
        ticks: generateTicks(minDate, maxDate, dayWidth),
        lanes,
    };
}

// ============================================================================
// COMBINED MAPPER
// ============================================================================

/**
 * One-shot conversion from Actions to GanttProjectionOutput.
 * Combines filtering, timeline derivation, and Gantt conversion.
 */
export function mapActionsToGantt(
    actions: Action[],
    projectId: string,
    filter?: TimelineFilter,
    options?: TimelineMapperOptions
): GanttProjectionOutput {
    // Convert to projection input format
    const projectionInputs = actions.map(a => actionToProjectionInput(a));

    // Derive timeline with filtering
    const timeline = deriveTimeline(projectionInputs, filter);

    // Convert to Gantt format
    return timelineToGantt(timeline, projectId, options, filter?.groupBy);
}

// ============================================================================
// HELPERS
// ============================================================================

function applyFilters(
    actions: ActionProjectionInput[],
    filter: TimelineFilter
): ActionProjectionInput[] {
    return actions.filter(action => {
        // Status filter
        if (filter.statuses && filter.statuses.length > 0) {
            const status = extractStatus(action);
            if (!status || !filter.statuses.includes(status)) {
                return false;
            }
        }

        // Assignee filter
        if (filter.assignees && filter.assignees.length > 0) {
            const assignee = extractAssignee(action);
            if (!assignee || !filter.assignees.includes(assignee)) {
                return false;
            }
        }

        // Parent filter: undefined = no filter, null = root only, string = specific parent
        if (filter.parentActionId !== undefined) {
            if (action.parent_action_id !== filter.parentActionId) {
                return false;
            }
        }

        // Date range filter
        if (filter.dateRange) {
            const start = extractStartDate(action);
            const end = extractDueDate(action);
            const actionStart = start ? new Date(start) : null;
            const actionEnd = end ? new Date(end) : null;

            if (filter.dateRange.start) {
                // Action must end after filter start
                const checkDate = actionEnd || actionStart;
                if (!checkDate || checkDate < filter.dateRange.start) {
                    return false;
                }
            }

            if (filter.dateRange.end) {
                // Action must start before filter end
                const checkDate = actionStart || actionEnd;
                if (!checkDate || checkDate > filter.dateRange.end) {
                    return false;
                }
            }
        }

        // Search filter
        if (filter.search && filter.search.trim()) {
            const title = extractTitle(action).toLowerCase();
            const search = filter.search.toLowerCase().trim();
            if (!title.includes(search)) {
                return false;
            }
        }

        return true;
    });
}

function groupEntries(
    entries: TimelineProjectionOutput['entries'],
    groupBy: TimelineFilter['groupBy'] = 'parent'
): Map<string, TimelineProjectionOutput['entries']> {
    const groups = new Map<string, TimelineProjectionOutput['entries']>();

    for (const entry of entries) {
        let key: string;

        switch (groupBy) {
            case 'status':
                key = (entry.metadata?.status as string) || 'unknown';
                break;
            case 'assignee':
                key = (entry.metadata?.assignee as string) || 'unassigned';
                break;
            case 'type':
                key = (entry.metadata?.type as string) || 'unknown';
                break;
            case 'parent':
            default:
                key = (entry.metadata?.parent_action_id as string) || 'root';
                break;
        }

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(entry);
    }

    return groups;
}

function formatGroupLabel(key: string, groupBy: TimelineFilter['groupBy']): string {
    if (key === 'root' || key === 'unknown' || key === 'unassigned') {
        switch (groupBy) {
            case 'status': return 'No Status';
            case 'assignee': return 'Unassigned';
            case 'type': return 'Other';
            case 'parent':
            default: return 'Root Level';
        }
    }

    // Capitalize and format
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function generateTicks(start: Date, end: Date, dayWidth: number): GanttDateTick[] {
    const ticks: GanttDateTick[] = [];
    const current = new Date(start);

    while (current <= end) {
        const x = Math.floor((current.getTime() - start.getTime()) / ONE_DAY_MS) * dayWidth;

        // Major tick on 1st of month (takes precedence over Monday)
        if (current.getDate() === 1) {
            ticks.push({
                date: current.toISOString(),
                x,
                label: current.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
                type: 'major',
            });
        } else if (current.getDay() === 1) {
            // Major tick on Mondays (except 1st of month)
            ticks.push({
                date: current.toISOString(),
                x,
                label: current.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                type: 'major',
            });
        }

        current.setDate(current.getDate() + 1);
    }

    return ticks;
}

// ============================================================================
// FILTER EXTRACTION HELPERS
// ============================================================================

/**
 * Extract unique statuses from actions for filter UI.
 */
export function extractUniqueStatuses(actions: ActionProjectionInput[]): string[] {
    const statuses = new Set<string>();
    for (const action of actions) {
        const status = extractStatus(action);
        if (status) statuses.add(status);
    }
    return Array.from(statuses).sort();
}

/**
 * Extract unique assignees from actions for filter UI.
 */
export function extractUniqueAssignees(actions: ActionProjectionInput[]): string[] {
    const assignees = new Set<string>();
    for (const action of actions) {
        const assignee = extractAssignee(action);
        if (assignee) assignees.add(assignee);
    }
    return Array.from(assignees).sort();
}

/**
 * Get date range from actions for filter UI.
 */
export function extractDateRange(actions: ActionProjectionInput[]): { min: Date | null; max: Date | null } {
    let min: Date | null = null;
    let max: Date | null = null;

    for (const action of actions) {
        const start = extractStartDate(action);
        const end = extractDueDate(action);

        if (start) {
            const d = new Date(start);
            if (!min || d < min) min = d;
            if (!max || d > max) max = d;
        }
        if (end) {
            const d = new Date(end);
            if (!min || d < min) min = d;
            if (!max || d > max) max = d;
        }
    }

    return { min, max };
}
