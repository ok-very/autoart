import {
    GanttProjectionOutput,
    GanttLane,
    GanttItem,
    GanttDateTick
} from '@autoart/shared';
import { HierarchyNode } from '../types';

/**
 * Maps a project hierarchy (project node + children) to a Gantt projection.
 * This is a frontend-side projection for immediate interactivity.
 */
export function mapHierarchyToGantt(
    project: HierarchyNode,
    children: HierarchyNode[], // All descendants flattened or just relevant ones
    options: { startDate?: Date; endDate?: Date } = {}
): GanttProjectionOutput {
    // 1. Determine Time Range
    // Default to Project start/due or today +/- 3 months
    const start = options.startDate
        ? new Date(options.startDate)
        : project.metadata && typeof project.metadata === 'object' && 'startDate' in project.metadata
            ? new Date(project.metadata.startDate as string)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // -1 month

    const end = options.endDate
        ? new Date(options.endDate)
        : project.metadata && typeof project.metadata === 'object' && 'dueDate' in project.metadata
            ? new Date(project.metadata.dueDate as string)
            : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // +3 months

    // Padding
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 14);

    const totalWidth = totalDays * dayWidth;
    // const headerHeight = 40; // Unused

    // 2. Generate Ticks
    const ticks: GanttDateTick[] = [];
    // eslint-disable-next-line prefer-const
    let current = new Date(start);
    while (current <= end) {
        const x = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth;
        // Minor tick every day
        // dots or plain lines, maybe just major ticks for weeks?

        // Major tick every Monday
        if (current.getDay() === 1) { // Monday
            ticks.push({
                date: current.toISOString(),
                x,
                label: current.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                type: 'major'
            });
        }

        // Major tick on 1st of month
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

    // 3. Process Lanes (Subprocesses) & Items (Tasks)
    // Structure: Project -> Process -> Stage -> Subprocess -> Task
    // We want Lanes = Subprocesses

    // Group tasks by subprocess
    const subprocesses = children.filter(n => n.type === 'subprocess');
    const tasks = children.filter(n => n.type === 'task');
    const tasksBySubprocess = new Map<string, HierarchyNode[]>();

    tasks.forEach(t => {
        if (t.parent_id) {
            const list = tasksBySubprocess.get(t.parent_id) || [];
            list.push(t);
            tasksBySubprocess.set(t.parent_id, list);
        }
    });

    const lanes: GanttLane[] = [];
    let currentY = 0;
    const laneHeight = 60; // Fixed for now, can be dynamic based on overlaps

    subprocesses.forEach(sp => {
        const spTasks = tasksBySubprocess.get(sp.id) || [];

        const items: GanttItem[] = spTasks.map(task => {
            // Helper to safe parse date
            const getTaskDate = (key: string, defaultDate: Date) => {
                const meta = task.metadata as Record<string, unknown> || {};
                if (meta[key] && typeof meta[key] === 'string') {
                    return new Date(meta[key] as string);
                }
                return defaultDate;
            };

            const tStart = getTaskDate('startDate', new Date()); // Default to now if missing
            const tEnd = getTaskDate('dueDate', new Date(Date.now() + 86400000));

            // Clamp to view (optional, but good for rendering)
            // Calculate X/W
            const x = Math.max(0, Math.floor((tStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth);
            const w = Math.max(dayWidth, Math.ceil((tEnd.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth);

            return {
                id: task.id,
                label: task.title,
                x,
                y: 10, // Padding from top of lane
                width: w,
                height: 40,
                color: '#3b82f6', // could map status to color
                metadata: task.metadata as Record<string, unknown>
            };
        });

        lanes.push({
            id: sp.id,
            label: sp.title,
            y: currentY,
            height: laneHeight,
            items,
            depth: 0,
            metadata: sp.metadata as Record<string, unknown>
        });

        currentY += laneHeight;
    });

    return {
        projectId: project.id,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalWidth,
        totalHeight: currentY,
        ticks,
        lanes
    };
}
