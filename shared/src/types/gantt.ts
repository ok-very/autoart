/**
 * Gantt Chart Types
 * 
 * Defines the projection output for Gantt charts, ensuring deterministic
 * layout calculations for both interactive (React) and static (PDF) rendering.
 */

// ============================================================================
// PRIMITIVES
// ============================================================================

export interface GanttDateTick {
    /** ISO date string or timestamp */
    date: string;
    /** X position in pixels */
    x: number;
    /** Label text (e.g. "Jan", "W1") */
    label: string;
    /** Type of tick for styling */
    type: 'major' | 'minor';
}

export interface GanttItem {
    id: string;
    /** Label to display on the bar */
    label: string;
    /** X position in pixels */
    x: number;
    /** Y position in pixels (relative to lane) */
    y: number;
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
    /** Color hex or class name reference */
    color?: string;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
}

export interface GanttLane {
    id: string;
    label: string;
    /** Y position in pixels (absolute in chart) */
    y: number;
    /** Height in pixels */
    height: number;
    /** Items within this lane */
    items: GanttItem[];
    /** Depth/Indentation level (0 is root) */
    depth: number;
    /** formatting/styling metadata */
    metadata?: Record<string, unknown>;
}

// ============================================================================
// PROJECTION OUTPUT
// ============================================================================

/**
 * The deterministic output of a Gantt projection.
 * Contains all geometry pre-calculated.
 */
export interface GanttProjectionOutput {
    /** Total width of the chart content in pixels */
    totalWidth: number;
    /** Total height of the chart content in pixels */
    totalHeight: number;
    /** Time axis ticks */
    ticks: GanttDateTick[];
    /** Swimlanes containing items */
    lanes: GanttLane[];
    /** Project ID this chart belongs to */
    projectId: string;
    /** Start date of the projection window (ISO) */
    startDate: string;
    /** End date of the projection window (ISO) */
    endDate: string;
}

// ============================================================================
// SELECTION & INTERACTION
// ============================================================================

export interface GanttSelection {
    /** 
     * Selected time range.
     * If only start is present, it's a point selection (cursor).
     */
    rangeStart?: string;
    rangeEnd?: string;

    /** Selected item IDs */
    selectedItemIds?: string[];

    /** Selected lane IDs */
    selectedLaneIds?: string[];
}
