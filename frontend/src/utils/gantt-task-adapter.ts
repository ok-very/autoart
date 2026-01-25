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
import type {
    HierarchyNode,
    GanttProjectionOutput,
    GanttLane,
    RecordTimelineFieldMapping,
    GanttRecordInput,
} from '@autoart/shared';
import type { FieldDef } from '@autoart/shared';

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
    /** Source type: 'node' for hierarchy nodes, 'record' for data records */
    sourceType?: 'node' | 'record';
    /** For records: the record ID (same as actionId but explicit) */
    recordId?: string;
    /** For records: the definition ID for context-aware editing */
    definitionId?: string;
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
    /** Records to render on the timeline */
    records?: GanttRecordInput[];
    /** Field mapping for records (auto-detected if not specified) */
    recordFieldMapping?: RecordTimelineFieldMapping;
    /** How to handle records without classification_node_id */
    unclassifiedRecordHandling?: 'hide' | 'unclassified-lane' | 'root-lane';
    /** Whether to render records (default: true if records provided) */
    showRecords?: boolean;
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
        showDependencies = true,
        records = [],
        showRecords = true,
        recordFieldMapping = {},
        unclassifiedRecordHandling = 'hide',
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
        sourceType: 'node',
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
            sourceType: 'node',
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
                sourceType: 'node',
                styles: {
                    backgroundColor: color,
                    backgroundSelectedColor: shadeColor(color, -15),
                    progressColor: shadeColor(color, -30),
                    progressSelectedColor: shadeColor(color, -40),
                }
            });
        });
    });

    // Process records if provided
    if (showRecords && records.length > 0) {
        // Build set of valid lane IDs (project + subprocesses)
        const validLaneIds = new Set<string>([project.id]);
        subprocesses.forEach(sp => validLaneIds.add(sp.id));

        // Create unclassified lane if needed
        let unclassifiedLaneId: string | undefined;
        const hasUnclassifiedRecords = records.some(r => !r.record.classification_node_id);

        if (unclassifiedRecordHandling === 'unclassified-lane' && hasUnclassifiedRecords) {
            // Namespace the synthetic lane ID by project to avoid collisions with real node IDs
            unclassifiedLaneId = `${project.id}::unclassified-records`;
            items.push({
                actionId: unclassifiedLaneId,
                label: 'Unclassified Records',
                start: minDate,
                end: maxDate,
                type: 'lane',
                laneId: project.id,
                hideChildren: false,
                sourceType: 'node',
                styles: {
                    backgroundColor: '#f1f5f9', // slate-100
                    backgroundSelectedColor: '#e2e8f0',
                }
            });
        }

        // Process each record
        for (const input of records) {
            const item = recordToRenderItem(input, recordFieldMapping, { defaultColor, statusColors });

            if (!item) continue; // No valid dates

            // Determine lane assignment
            if (!item.laneId) {
                if (unclassifiedRecordHandling === 'hide') {
                    continue;
                } else if (unclassifiedRecordHandling === 'unclassified-lane') {
                    // Fall back to root lane if unclassified lane wasn't created
                    item.laneId = unclassifiedLaneId ?? project.id;
                } else if (unclassifiedRecordHandling === 'root-lane') {
                    item.laneId = project.id;
                }
            } else if (!validLaneIds.has(item.laneId)) {
                // Record's classification_node_id doesn't match any visible lane
                // Assign to root lane instead
                item.laneId = project.id;
            }

            trackDates({ start: item.start, end: item.end });
            items.push(item);
        }
    }

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
 * Shade a hex color lighter (positive) or darker (negative).
 * Returns original color if not a valid 6-digit hex.
 */
function shadeColor(color: string, percent: number): string {
    // Validate: must be #RRGGBB format
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return color;
    }
    const num = parseInt(color.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ============================================================================
// RECORD FIELD EXTRACTION
// ============================================================================

/** Conventional start date field keys (checked in order) */
const START_DATE_KEYS = ['startDate', 'start_date', 'start', 'startdate', 'begin', 'begin_date'];

/** Conventional end date field keys (checked in order) */
const END_DATE_KEYS = ['dueDate', 'due_date', 'endDate', 'end_date', 'due', 'end', 'deadline'];

/** Cache for auto-detected field mappings by definition ID */
const fieldMappingCache = new Map<string, RecordTimelineFieldMapping>();

/** Clear the field mapping cache (useful for testing or when definitions change) */
export function clearFieldMappingCache(): void {
    fieldMappingCache.clear();
}

/**
 * Find a date field in the record definition by renderHint or conventional naming.
 */
function findDateField(
    fields: FieldDef[],
    preferredKeys: string[],
    renderHint?: string
): FieldDef | undefined {
    // First: check for explicit renderHint
    if (renderHint) {
        const hintMatch = fields.find(f => f.type === 'date' && f.renderHint === renderHint);
        if (hintMatch) return hintMatch;
    }

    // Second: check for timeline renderHint with start/end suffix
    const timelineFields = fields.filter(f => f.renderHint === 'timeline' && f.type === 'date');
    if (timelineFields.length > 0) {
        for (const key of preferredKeys) {
            const match = timelineFields.find(f =>
                f.key.toLowerCase().includes(key.toLowerCase())
            );
            if (match) return match;
        }
    }

    // Third: check by conventional field names
    for (const key of preferredKeys) {
        const match = fields.find(f =>
            f.type === 'date' &&
            (f.key === key || f.key.toLowerCase() === key.toLowerCase())
        );
        if (match) return match;
    }

    return undefined;
}

/**
 * Auto-detect field mapping for a record definition.
 */
function autoDetectFieldMapping(fields: FieldDef[]): RecordTimelineFieldMapping {
    const startField = findDateField(fields, START_DATE_KEYS, 'timeline-start');
    const endField = findDateField(fields, END_DATE_KEYS, 'timeline-end');

    // For status: prioritize type='status', then fall back to conventional names with status/select type
    const statusField =
        fields.find(f => f.type === 'status') ||
        fields.find(f =>
            (f.type === 'select' || f.type === 'status') &&
            ['status', 'state', 'stage'].includes(f.key.toLowerCase())
        );

    // For progress: prioritize type='percent', then fall back to conventional names with number/percent type
    const progressField =
        fields.find(f => f.type === 'percent') ||
        fields.find(f =>
            (f.type === 'number' || f.type === 'percent') &&
            ['progress', 'completion', 'percent_complete', 'percentcomplete'].includes(f.key.toLowerCase())
        );

    return {
        startField: startField?.key,
        endField: endField?.key,
        statusField: statusField?.key,
        progressField: progressField?.key,
    };
}

/**
 * Extract a date value from record data.
 */
function extractRecordDate(
    data: Record<string, unknown>,
    fieldKey: string | undefined
): Date | null {
    if (!fieldKey) return null;

    const value = data[fieldKey];
    if (!value) return null;

    if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    }

    if (value instanceof Date) {
        return value;
    }

    // Handle number (timestamp) - detect seconds vs milliseconds
    // Timestamps before year 2001 in ms would be < 1e12, but in seconds would be reasonable dates
    // Use 1e11 as threshold: values below are likely seconds (dates after 1973)
    if (typeof value === 'number') {
        const timestamp = value < 1e11 ? value * 1000 : value;
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date;
    }

    return null;
}

/**
 * Extract status value from record data.
 */
function extractRecordStatus(
    data: Record<string, unknown>,
    fieldKey: string | undefined
): string {
    if (!fieldKey) return 'default';

    const value = data[fieldKey];
    if (typeof value === 'string') return value;

    return 'default';
}

/**
 * Extract progress value from record data.
 */
function extractRecordProgress(
    data: Record<string, unknown>,
    fieldKey: string | undefined
): number | undefined {
    if (!fieldKey) return undefined;

    const value = data[fieldKey];
    if (typeof value === 'number') {
        return Math.max(0, Math.min(100, value));
    }

    // Handle string values like "75" or "75%"
    if (typeof value === 'string') {
        const parsed = parseFloat(value.replace('%', ''));
        if (!isNaN(parsed)) {
            return Math.max(0, Math.min(100, parsed));
        }
    }

    return undefined;
}

/**
 * Convert a single record to a GanttRenderItem.
 * Returns null if the record has no valid dates.
 */
function recordToRenderItem(
    input: GanttRecordInput,
    explicitMapping: RecordTimelineFieldMapping,
    options: { defaultColor?: string; statusColors?: Record<string, string> }
): GanttRenderItem | null {
    const { record, definition } = input;
    const { defaultColor = DEFAULT_COLORS.default, statusColors = DEFAULT_COLORS } = options;

    // Get fields from definition schema
    const fields = definition.schema_config?.fields ?? [];

    // Use cached auto-detected mapping if available
    let autoMapping = fieldMappingCache.get(definition.id);
    if (!autoMapping) {
        autoMapping = autoDetectFieldMapping(fields);
        fieldMappingCache.set(definition.id, autoMapping);
    }

    // Resolve field mapping (explicit overrides auto-detected)
    const mapping: RecordTimelineFieldMapping = {
        ...autoMapping,
        ...explicitMapping,
    };

    // Extract dates
    const data = record.data ?? {};
    const start = extractRecordDate(data, mapping.startField);
    const end = extractRecordDate(data, mapping.endField);

    // Must have at least one date
    if (!start && !end) {
        return null;
    }

    // Default dates
    const now = new Date();
    const effectiveStart = start || end || now;
    let effectiveEnd = end || start || now;

    // Ensure end is after start
    if (effectiveEnd <= effectiveStart) {
        effectiveEnd = new Date(effectiveStart.getTime() + ONE_DAY_MS);
    }

    // Extract other fields
    const status = extractRecordStatus(data, mapping.statusField);
    const progress = extractRecordProgress(data, mapping.progressField);
    const label = mapping.labelField
        ? (data[mapping.labelField] as string) || record.unique_name
        : record.unique_name;

    const isCompleted = status === 'completed' || status === 'done';
    const color = statusColors[status] || defaultColor;

    return {
        actionId: record.id,
        label,
        start: effectiveStart,
        end: effectiveEnd,
        type: isCompleted ? 'milestone' : 'item',
        progress: progress ?? (isCompleted ? 100 : 0),
        laneId: record.classification_node_id || undefined,
        sourceType: 'record',
        recordId: record.id,
        definitionId: definition.id,
        styles: {
            backgroundColor: color,
            backgroundSelectedColor: shadeColor(color, -15),
            progressColor: shadeColor(color, -30),
            progressSelectedColor: shadeColor(color, -40),
        },
    };
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
