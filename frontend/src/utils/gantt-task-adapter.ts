/**
 * Gantt Render Adapter
 *
 * Maps autoart data structures to gantt-task-react for rendering.
 *
 * NOMENCLATURE BOUNDARY:
 * The gantt-task-react library uses "Task" as its core type, which conflicts
 * with our hierarchy nomenclature (project → process → stage → subprocess → task).
 * This adapter quarantines that terminology - the library's "Task" type is used
 * ONLY internally. Our codebase sees GanttRenderItem and GanttRenderOutput.
 */

import type { Task as LibraryTask } from 'gantt-task-react';
import { ViewMode } from 'gantt-task-react';
import type { HierarchyNode, GanttProjectionOutput, GanttLane } from '@autoart/shared';

// ============================================================================
// PUBLIC TYPES (What our codebase sees)
// ============================================================================

/**
 * A renderable item in the Gantt chart.
 * Clean domain type that hides library terminology.
 */
export interface GanttRenderItem {
    /** Action ID (from our domain) */
    actionId: string;
    /** Display label */
    label: string;
    /** Start date */
    start: Date;
    /** End date */
    end: Date;
    /** Item type: 'lane' for grouping rows, 'item' for individual bars, 'milestone' for points */
    type: 'lane' | 'item' | 'milestone';
    /** Parent lane ID (for items within lanes) */
    laneId?: string;
    /** Progress percentage (0-100) */
    progress?: number;
    /** Dependencies (other action IDs) */
    dependencies?: string[];
    /** Hide children in collapsed view */
    hideChildren?: boolean;
    /** Visual styling */
    styles?: {
        backgroundColor?: string;
        backgroundSelectedColor?: string;
        progressColor?: string;
        progressSelectedColor?: string;
    };
}

/**
 * Output from render functions - what components receive.
 */
export interface GanttRenderOutput {
    /** Renderable items */
    items: GanttRenderItem[];
    /** Suggested view mode based on date range */
    viewMode: ViewMode;
    /** Suggested view start date */
    viewDate: Date;
}

export interface GanttAdapterOptions {
    /** Default item color if none specified */
    defaultColor?: string;
    /** Color mapping by status (metadata.status) */
    statusColors?: Record<string, string>;
    /** Show dependencies between items */
    showDependencies?: boolean;
    /** Base date for the view (defaults to earliest item start) */
    viewStartDate?: Date;
    /** End date for the view (defaults to latest item end) */
    viewEndDate?: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_COLORS: Record<string, string> = {
    'not_started': '#94a3b8',  // slate-400
    'in_progress': '#3b82f6',  // blue-500
    'blocked': '#ef4444',      // red-500
    'completed': '#22c55e',    // green-500
    'default': '#6366f1',      // indigo-500
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// HIERARCHY NODE -> RENDER OUTPUT
// ============================================================================

/**
 * Renders HierarchyNode[] to GanttRenderOutput.
 * This is the primary adapter for interactive Gantt views.
 */
export function renderHierarchy(
    project: HierarchyNode,
    children: HierarchyNode[],
    options: GanttAdapterOptions = {}
): GanttRenderOutput {
    const {
        defaultColor = DEFAULT_COLORS.default,
        statusColors = DEFAULT_COLORS,
        showDependencies = true
    } = options;

    const items: GanttRenderItem[] = [];

    // Group by type for hierarchy
    const subprocesses = children.filter(n => n.type === 'subprocess');
    const taskNodes = children.filter(n => n.type === 'task');
    const tasksBySubprocess = new Map<string, HierarchyNode[]>();

    taskNodes.forEach(t => {
        if (t.parent_id) {
            const list = tasksBySubprocess.get(t.parent_id) || [];
            list.push(t);
            tasksBySubprocess.set(t.parent_id, list);
        }
    });

    // Track date range for view - include all items
    let minDate = new Date();
    let maxDate = new Date();
    let hasAnyDates = false;

    // Helper to update date range
    const trackDates = (dates: { start: Date; end: Date }) => {
        if (dates.start < minDate || !hasAnyDates) minDate = new Date(dates.start);
        if (dates.end > maxDate || !hasAnyDates) maxDate = new Date(dates.end);
        hasAnyDates = true;
    };

    // Add project as root lane
    const projectDates = extractDates(project.metadata);
    trackDates(projectDates);
    items.push({
        actionId: project.id,
        label: project.title,
        start: projectDates.start,
        end: projectDates.end,
        type: 'lane',
        progress: calculateProgress(taskNodes),
        hideChildren: false,
        styles: {
            backgroundColor: statusColors[getStatus(project.metadata)] || defaultColor,
            backgroundSelectedColor: shadeColor(statusColors[getStatus(project.metadata)] || defaultColor, -15),
            progressColor: '#22c55e',
            progressSelectedColor: '#16a34a',
        }
    });

    // Add subprocesses as lane groups
    subprocesses.forEach(sp => {
        const spItems = tasksBySubprocess.get(sp.id) || [];
        const spDates = extractDates(sp.metadata, spItems);
        trackDates(spDates);

        items.push({
            actionId: sp.id,
            label: sp.title,
            start: spDates.start,
            end: spDates.end,
            type: 'lane',
            progress: calculateProgress(spItems),
            laneId: project.id,
            hideChildren: false,
            styles: {
                backgroundColor: '#e2e8f0', // slate-200
                backgroundSelectedColor: '#cbd5e1', // slate-300
                progressColor: '#22c55e',
                progressSelectedColor: '#16a34a',
            }
        });

        // Add hierarchy tasks as render items within subprocess
        spItems.forEach(node => {
            const nodeDates = extractDates(node.metadata);
            const status = getStatus(node.metadata);
            const color = statusColors[status] || defaultColor;
            trackDates(nodeDates);

            // Extract dependencies from metadata
            const deps: string[] = [];
            if (showDependencies && node.metadata) {
                const meta = node.metadata as Record<string, unknown>;
                if (Array.isArray(meta.dependencies)) {
                    deps.push(...meta.dependencies.filter((d): d is string => typeof d === 'string'));
                }
                if (typeof meta.dependsOn === 'string') {
                    deps.push(meta.dependsOn);
                }
            }

            items.push({
                actionId: node.id,
                label: node.title,
                start: nodeDates.start,
                end: nodeDates.end,
                type: status === 'completed' ? 'milestone' : 'item',
                progress: status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0,
                laneId: sp.id,
                dependencies: deps.length > 0 ? deps : undefined,
                styles: {
                    backgroundColor: color,
                    backgroundSelectedColor: shadeColor(color, -15),
                    progressColor: shadeColor(color, -30),
                    progressSelectedColor: shadeColor(color, -40),
                }
            });
        });
    });

    // Determine view mode based on date range
    const rangeDays = (maxDate.getTime() - minDate.getTime()) / ONE_DAY_MS;
    let viewMode: ViewMode = ViewMode.Day;
    if (rangeDays > 180) viewMode = ViewMode.Month;
    else if (rangeDays > 60) viewMode = ViewMode.Week;

    // Pad view date range
    const viewDate = new Date(minDate);
    viewDate.setDate(viewDate.getDate() - 7);

    return { items, viewMode, viewDate };
}

// ============================================================================
// PROJECTION OUTPUT -> RENDER OUTPUT
// ============================================================================

/**
 * Renders GanttProjectionOutput to GanttRenderOutput.
 * Useful when you have a pre-calculated projection and want to render it
 * (reverse mapping from pixel positions to dates).
 */
export function renderProjection(
    projection: GanttProjectionOutput,
    options: GanttAdapterOptions = {}
): GanttRenderOutput {
    const {
        defaultColor = DEFAULT_COLORS.default,
        statusColors = DEFAULT_COLORS,
    } = options;

    const items: GanttRenderItem[] = [];
    let startDate = new Date(projection.startDate);
    let endDate = new Date(projection.endDate);

    // Ensure valid date range (minimum 30 days if invalid/equal)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        endDate = new Date(startDate.getTime() + 30 * ONE_DAY_MS);
    }

    const totalMs = endDate.getTime() - startDate.getTime();

    // Calculate ms per pixel for reverse mapping
    const msPerPixel = projection.totalWidth > 0
        ? totalMs / projection.totalWidth
        : ONE_DAY_MS; // Default to 1 day per pixel if no width

    projection.lanes.forEach(lane => {
        // Add lane as grouping row
        const laneDates = getLaneDateRange(lane, startDate, msPerPixel);

        items.push({
            actionId: lane.id,
            label: lane.label,
            start: laneDates.start,
            end: laneDates.end,
            type: 'lane',
            progress: 0,
            hideChildren: false,
            styles: {
                backgroundColor: '#e2e8f0',
                backgroundSelectedColor: '#cbd5e1',
            }
        });

        // Add items within lane
        lane.items.forEach(laneItem => {
            const itemStart = new Date(startDate.getTime() + (laneItem.x * msPerPixel));
            let itemEnd = new Date(startDate.getTime() + ((laneItem.x + laneItem.width) * msPerPixel));
            const status = getStatus(laneItem.metadata);

            // Determine if this is a milestone (zero-width or completed status)
            const isMilestone = laneItem.width === 0 || status === 'completed';

            // For non-milestones, ensure end is after start (minimum 1 day)
            // Milestones can have start === end (point in time)
            if (!isMilestone && itemEnd <= itemStart) {
                itemEnd = new Date(itemStart.getTime() + ONE_DAY_MS);
            }

            const color = laneItem.color || statusColors[status] || defaultColor;

            items.push({
                actionId: laneItem.id,
                label: laneItem.label,
                start: itemStart,
                end: isMilestone ? itemStart : itemEnd,
                type: isMilestone ? 'milestone' : 'item',
                progress: status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0,
                laneId: lane.id,
                styles: {
                    backgroundColor: color,
                    backgroundSelectedColor: shadeColor(color, -15),
                    progressColor: shadeColor(color, -30),
                    progressSelectedColor: shadeColor(color, -40),
                }
            });
        });
    });

    // Determine view mode based on date range
    const rangeDays = (endDate.getTime() - startDate.getTime()) / ONE_DAY_MS;
    let viewMode: ViewMode = ViewMode.Day;
    if (rangeDays > 180) viewMode = ViewMode.Month;
    else if (rangeDays > 60) viewMode = ViewMode.Week;

    const viewDate = new Date(startDate);
    viewDate.setDate(viewDate.getDate() - 7);

    return { items, viewMode, viewDate };
}

// ============================================================================
// HELPERS
// ============================================================================

function extractDates(
    metadata: Record<string, unknown> | null | undefined,
    childNodes?: HierarchyNode[]
): { start: Date; end: Date } {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 7 * ONE_DAY_MS);
    const defaultEnd = new Date(now.getTime() + 30 * ONE_DAY_MS);

    let start = defaultStart;
    let end = defaultEnd;

    if (metadata && typeof metadata === 'object') {
        if (metadata.startDate && typeof metadata.startDate === 'string') {
            start = new Date(metadata.startDate);
        }
        if (metadata.dueDate && typeof metadata.dueDate === 'string') {
            end = new Date(metadata.dueDate);
        }
    }

    // If we have child nodes, compute range from them
    if (childNodes && childNodes.length > 0) {
        let minStart = start;
        let maxEnd = end;
        let hasChildDates = false;

        childNodes.forEach(child => {
            const childDates = extractDates(child.metadata as Record<string, unknown>);
            if (!hasChildDates || childDates.start < minStart) minStart = childDates.start;
            if (!hasChildDates || childDates.end > maxEnd) maxEnd = childDates.end;
            hasChildDates = true;
        });

        if (hasChildDates) {
            start = minStart;
            end = maxEnd;
        }
    }

    // Ensure end is after start
    if (end <= start) {
        end = new Date(start.getTime() + ONE_DAY_MS);
    }

    return { start, end };
}

function getLaneDateRange(
    lane: GanttLane,
    baseDate: Date,
    msPerPixel: number
): { start: Date; end: Date } {
    if (lane.items.length === 0) {
        return { start: baseDate, end: new Date(baseDate.getTime() + ONE_DAY_MS) };
    }

    const minX = Math.min(...lane.items.map(i => i.x));
    const maxX = Math.max(...lane.items.map(i => i.x + i.width));

    return {
        start: new Date(baseDate.getTime() + (minX * msPerPixel)),
        end: new Date(baseDate.getTime() + (maxX * msPerPixel)),
    };
}

function getStatus(metadata: Record<string, unknown> | null | undefined): string {
    if (metadata && typeof metadata === 'object' && typeof metadata.status === 'string') {
        return metadata.status;
    }
    return 'default';
}

function calculateProgress(tasks: HierarchyNode[]): number {
    if (tasks.length === 0) return 0;

    const completed = tasks.filter(t => {
        const meta = t.metadata as Record<string, unknown>;
        return meta?.status === 'completed';
    }).length;

    return Math.round((completed / tasks.length) * 100);
}

/**
 * Shade a hex color lighter (positive) or darker (negative)
 */
function shadeColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ============================================================================
// RENDER OUTPUT -> PROJECTION (for WYSIWYG PDF)
// ============================================================================

/**
 * Converts GanttRenderOutput back to GanttProjectionOutput
 * for PDF generation (ensuring what-you-see-is-what-you-print).
 */
export function projectionFromRender(
    renderOutput: GanttRenderOutput,
    projectId: string,
    options: { dayWidth?: number; laneHeight?: number } = {}
): GanttProjectionOutput {
    const { dayWidth = 30, laneHeight = 60 } = options;
    const { items } = renderOutput;

    // Handle empty items - use default 30-day range from today
    if (items.length === 0) {
        const now = new Date();
        const defaultStart = new Date(now.getTime() - 7 * ONE_DAY_MS);
        const defaultEnd = new Date(now.getTime() + 30 * ONE_DAY_MS);
        return {
            projectId,
            startDate: defaultStart.toISOString(),
            endDate: defaultEnd.toISOString(),
            totalWidth: 37 * dayWidth,
            totalHeight: 0,
            ticks: [],
            lanes: [],
        };
    }

    // Find date range
    const allDates = items.flatMap(item => [item.start, item.end]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    // Pad range
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);

    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / ONE_DAY_MS);
    const totalWidth = totalDays * dayWidth;

    // Generate ticks
    const ticks: GanttProjectionOutput['ticks'] = [];
    const current = new Date(minDate);
    while (current <= maxDate) {
        const x = Math.floor((current.getTime() - minDate.getTime()) / ONE_DAY_MS) * dayWidth;

        if (current.getDay() === 1) {
            ticks.push({
                date: current.toISOString(),
                x,
                label: current.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                type: 'major'
            });
        }
        if (current.getDate() === 1) {
            ticks.push({
                date: current.toISOString(),
                x,
                label: current.toLocaleDateString(undefined, { month: 'long' }),
                type: 'major'
            });
        }
        current.setDate(current.getDate() + 1);
    }

    // Build lanes from lane-type items
    const laneItems = items.filter(item => item.type === 'lane' && item.laneId);
    const nonLaneItems = items.filter(item => item.type !== 'lane');

    const lanes: GanttProjectionOutput['lanes'] = [];
    let currentY = 0;

    laneItems.forEach(laneItem => {
        const childItems = nonLaneItems
            .filter(item => item.laneId === laneItem.actionId)
            .map(item => {
                const x = Math.floor((item.start.getTime() - minDate.getTime()) / ONE_DAY_MS) * dayWidth;
                const width = Math.max(dayWidth, Math.ceil((item.end.getTime() - item.start.getTime()) / ONE_DAY_MS) * dayWidth);

                return {
                    id: item.actionId,
                    label: item.label,
                    x,
                    y: 10,
                    width,
                    height: 40,
                    color: item.styles?.backgroundColor,
                };
            });

        lanes.push({
            id: laneItem.actionId,
            label: laneItem.label,
            y: currentY,
            height: laneHeight,
            items: childItems,
            depth: 0,
        });

        currentY += laneHeight;
    });

    return {
        projectId,
        startDate: minDate.toISOString(),
        endDate: maxDate.toISOString(),
        totalWidth,
        totalHeight: currentY,
        ticks,
        lanes,
    };
}

// ============================================================================
// LIBRARY BOUNDARY (Internal - converts to/from gantt-task-react types)
// ============================================================================

/**
 * Converts our clean GanttRenderItem[] to the library's Task[].
 * This is the ONLY place where library types should be constructed.
 * @internal Used by TimelineWrapper
 */
export function toLibraryFormat(items: GanttRenderItem[]): LibraryTask[] {
    return items.map(item => ({
        id: item.actionId,
        name: item.label,
        start: item.start,
        end: item.end,
        type: item.type === 'lane' ? 'project' : item.type === 'milestone' ? 'milestone' : 'task',
        // Milestones default to 100% (completed) if no explicit progress
        progress: item.progress ?? (item.type === 'milestone' ? 100 : 0),
        project: item.laneId,
        dependencies: item.dependencies,
        hideChildren: item.hideChildren,
        styles: item.styles,
    }));
}

/**
 * Extracts the actionId from a library Task.
 * Use this to translate library callbacks back to our domain.
 * @internal Used by TimelineWrapper event handlers
 */
export function actionIdFromLibrary(libraryTask: LibraryTask): string {
    return libraryTask.id;
}

/**
 * Converts a library Task back to our GanttRenderItem.
 * Use this when you need the full item data from a library callback.
 * @internal Used by TimelineWrapper when items are modified by the library
 */
export function fromLibraryFormat(libraryTask: LibraryTask): GanttRenderItem {
    return {
        actionId: libraryTask.id,
        label: libraryTask.name,
        start: libraryTask.start,
        end: libraryTask.end,
        type: libraryTask.type === 'project' ? 'lane' : libraryTask.type === 'milestone' ? 'milestone' : 'item',
        progress: libraryTask.progress,
        laneId: libraryTask.project,
        dependencies: libraryTask.dependencies,
        hideChildren: libraryTask.hideChildren,
        styles: libraryTask.styles as GanttRenderItem['styles'],
    };
}
