/**
 * Gantt Task Adapter
 *
 * Maps autoart data structures to gantt-task-react's Task format.
 * This adapter bridges your HierarchyNode/GanttProjectionOutput
 * to the gantt-task-react library for interactive rendering.
 */

import type { Task } from 'gantt-task-react';
import { ViewMode } from 'gantt-task-react';
import type { HierarchyNode, GanttProjectionOutput, GanttLane } from '@autoart/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface GanttTaskAdapterOptions {
    /** Default task color if none specified */
    defaultColor?: string;
    /** Color mapping by status (metadata.status) */
    statusColors?: Record<string, string>;
    /** Show dependencies between tasks */
    showDependencies?: boolean;
    /** Base date for the view (defaults to earliest task start) */
    viewStartDate?: Date;
    /** End date for the view (defaults to latest task end) */
    viewEndDate?: Date;
}

export interface MappedGanttData {
    tasks: Task[];
    viewMode: ViewMode;
    viewDate: Date;
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
// HIERARCHY NODE -> TASK MAPPING
// ============================================================================

/**
 * Maps HierarchyNode[] to gantt-task-react Task[].
 * This is the primary adapter for interactive Gantt views.
 */
export function mapHierarchyToTasks(
    project: HierarchyNode,
    children: HierarchyNode[],
    options: GanttTaskAdapterOptions = {}
): MappedGanttData {
    const {
        defaultColor = DEFAULT_COLORS.default,
        statusColors = DEFAULT_COLORS,
        showDependencies = true
    } = options;

    const tasks: Task[] = [];

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

    // Track date range for view
    let minDate = new Date();
    let maxDate = new Date();
    let hasAnyDates = false;

    // Add project as root task
    const projectDates = extractDates(project.metadata);
    tasks.push({
        id: project.id,
        name: project.title,
        start: projectDates.start,
        end: projectDates.end,
        type: 'project',
        progress: calculateProgress(taskNodes),
        hideChildren: false,
        styles: {
            backgroundColor: statusColors[getStatus(project.metadata)] || defaultColor,
            backgroundSelectedColor: shadeColor(statusColors[getStatus(project.metadata)] || defaultColor, -15),
            progressColor: '#22c55e',
            progressSelectedColor: '#16a34a',
        }
    });

    // Add subprocesses as project groups
    subprocesses.forEach(sp => {
        const spTasks = tasksBySubprocess.get(sp.id) || [];
        const spDates = extractDates(sp.metadata, spTasks);

        tasks.push({
            id: sp.id,
            name: sp.title,
            start: spDates.start,
            end: spDates.end,
            type: 'project',
            progress: calculateProgress(spTasks),
            project: project.id,
            hideChildren: false,
            styles: {
                backgroundColor: '#e2e8f0', // slate-200
                backgroundSelectedColor: '#cbd5e1', // slate-300
                progressColor: '#22c55e',
                progressSelectedColor: '#16a34a',
            }
        });

        // Add tasks within subprocess
        spTasks.forEach(task => {
            const taskDates = extractDates(task.metadata);
            const status = getStatus(task.metadata);
            const color = statusColors[status] || defaultColor;

            // Track date range
            if (taskDates.start < minDate || !hasAnyDates) minDate = new Date(taskDates.start);
            if (taskDates.end > maxDate || !hasAnyDates) maxDate = new Date(taskDates.end);
            hasAnyDates = true;

            // Extract dependencies from metadata
            const dependencies: string[] = [];
            if (showDependencies && task.metadata) {
                const meta = task.metadata as Record<string, unknown>;
                if (Array.isArray(meta.dependencies)) {
                    dependencies.push(...meta.dependencies.filter((d): d is string => typeof d === 'string'));
                }
                if (typeof meta.dependsOn === 'string') {
                    dependencies.push(meta.dependsOn);
                }
            }

            tasks.push({
                id: task.id,
                name: task.title,
                start: taskDates.start,
                end: taskDates.end,
                type: status === 'completed' ? 'milestone' : 'task',
                progress: status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0,
                project: sp.id,
                dependencies: dependencies.length > 0 ? dependencies : undefined,
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

    return { tasks, viewMode, viewDate };
}

// ============================================================================
// PROJECTION OUTPUT -> TASK MAPPING
// ============================================================================

/**
 * Maps GanttProjectionOutput back to gantt-task-react Task[].
 * Useful when you have a pre-calculated projection and want to render it
 * with gantt-task-react (reverse mapping from pixel positions to dates).
 */
export function mapProjectionToTasks(
    projection: GanttProjectionOutput,
    options: GanttTaskAdapterOptions = {}
): MappedGanttData {
    const {
        defaultColor = DEFAULT_COLORS.default,
        statusColors = DEFAULT_COLORS,
    } = options;

    const tasks: Task[] = [];
    const startDate = new Date(projection.startDate);
    const endDate = new Date(projection.endDate);
    const totalMs = endDate.getTime() - startDate.getTime();

    // Calculate ms per pixel for reverse mapping (guard against zero/negative duration and width)
    const msPerPixel = (projection.totalWidth > 0 && totalMs > 0)
        ? totalMs / projection.totalWidth
        : 1;

    projection.lanes.forEach(lane => {
        // Add lane as project group
        const laneDates = getLaneDateRange(lane, startDate, msPerPixel);

        tasks.push({
            id: lane.id,
            name: lane.label,
            start: laneDates.start,
            end: laneDates.end,
            type: 'project',
            progress: 0,
            hideChildren: false,
            styles: {
                backgroundColor: '#e2e8f0',
                backgroundSelectedColor: '#cbd5e1',
            }
        });

        // Add items within lane
        lane.items.forEach(item => {
            const itemStart = new Date(startDate.getTime() + (item.x * msPerPixel));
            const itemEnd = new Date(startDate.getTime() + ((item.x + item.width) * msPerPixel));
            const status = getStatus(item.metadata);
            const color = item.color || statusColors[status] || defaultColor;

            tasks.push({
                id: item.id,
                name: item.label,
                start: itemStart,
                end: itemEnd,
                type: 'task',
                progress: status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0,
                project: lane.id,
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

    return { tasks, viewMode, viewDate };
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
// TASK -> PROJECTION SYNC (for WYSIWYG PDF)
// ============================================================================

/**
 * Converts gantt-task-react Task[] back to GanttProjectionOutput
 * for PDF generation (ensuring what-you-see-is-what-you-print).
 */
export function tasksToProjection(
    tasks: Task[],
    projectId: string,
    options: { dayWidth?: number; laneHeight?: number } = {}
): GanttProjectionOutput {
    const { dayWidth = 30, laneHeight = 60 } = options;

    // Find date range
    const allDates = tasks.flatMap(t => [t.start, t.end]);
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

    // Build lanes from project-type tasks
    const projectTasks = tasks.filter(t => t.type === 'project' && t.project);
    const itemTasks = tasks.filter(t => t.type !== 'project');

    const lanes: GanttProjectionOutput['lanes'] = [];
    let currentY = 0;

    projectTasks.forEach(pt => {
        const laneItems = itemTasks
            .filter(t => t.project === pt.id)
            .map(t => {
                const x = Math.floor((t.start.getTime() - minDate.getTime()) / ONE_DAY_MS) * dayWidth;
                const width = Math.max(dayWidth, Math.ceil((t.end.getTime() - t.start.getTime()) / ONE_DAY_MS) * dayWidth);

                return {
                    id: t.id,
                    label: t.name,
                    x,
                    y: 10,
                    width,
                    height: 40,
                    color: t.styles?.backgroundColor,
                };
            });

        lanes.push({
            id: pt.id,
            label: pt.name,
            y: currentY,
            height: laneHeight,
            items: laneItems,
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
