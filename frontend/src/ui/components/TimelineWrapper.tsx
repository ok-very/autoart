/**
 * TimelineWrapper
 *
 * Adapter component that wraps gantt-task-react with Tailwind-friendly
 * customization. Provides a unified interface for both Gantt View
 * (with dependencies/sidebar) and Project Log (minimal timeline).
 *
 * NOMENCLATURE BOUNDARY:
 * The library's "Task" type is quarantined within this component.
 * External consumers only see GanttRenderItem and actionId-based callbacks.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Gantt, Task as LibraryTask, ViewMode, StylingOption } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import type {
    HierarchyNode,
    GanttProjectionOutput,
    GanttSelection,
    GanttRecordInput,
    RecordTimelineFieldMapping,
} from '@autoart/shared';
import {
    renderHierarchy,
    renderProjection,
    projectionFromRender,
    toLibraryFormat,
    fromLibraryFormat,
    type GanttAdapterOptions,
    type GanttRenderOutput,
    type GanttRenderItem,
} from '../../utils/gantt-task-adapter';

// ============================================================================
// TYPES
// ============================================================================

export type TimelineMode = 'gantt' | 'log';

export interface TimelineWrapperProps {
    /** Display mode: 'gantt' shows sidebar/deps, 'log' shows minimal timeline */
    mode?: TimelineMode;

    /** Data source: provide either projection OR hierarchy data */
    projection?: GanttProjectionOutput;
    project?: HierarchyNode;
    children?: HierarchyNode[];

    /** Records to display on timeline (requires project/children data source) */
    records?: GanttRecordInput[];
    /** Field mapping for records (auto-detected if not specified) */
    recordFieldMapping?: RecordTimelineFieldMapping;
    /** How to handle records without classification_node_id */
    unclassifiedRecordHandling?: 'hide' | 'unclassified-lane' | 'root-lane';

    /** Adapter options for mapping (records can also be passed here) */
    adapterOptions?: GanttAdapterOptions;

    /** Selection state (controlled) */
    selection?: GanttSelection;
    onSelectionChange?: (selection: GanttSelection) => void;

    /** Item events - uses actionId (not library's "task" terminology) */
    onItemClick?: (item: GanttRenderItem) => void;
    onItemDoubleClick?: (item: GanttRenderItem) => void;
    onDateChange?: (item: GanttRenderItem, start: Date, end: Date) => void;
    onProgressChange?: (item: GanttRenderItem, progress: number) => void;

    /** For WYSIWYG PDF sync - called when items change */
    onProjectionChange?: (projection: GanttProjectionOutput) => void;

    /** View control */
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;

    /** Styling */
    className?: string;
    rowHeight?: number;
    columnWidth?: number;
    headerHeight?: number;
}

// ============================================================================
// CUSTOM RENDERERS (Tailwind-friendly)
// ============================================================================

interface TooltipContentProps {
    task: LibraryTask;
    fontSize: string;
    fontFamily: string;
}

const TooltipContent = ({ task }: TooltipContentProps) => {
    const formatDate = (d: Date) => d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <div className="bg-slate-900 text-white text-xs rounded-lg shadow-xl p-3 min-w-[180px]">
            <div className="font-semibold mb-2 text-sm">{task.name}</div>
            <div className="space-y-1 text-slate-300">
                <div className="flex justify-between gap-4">
                    <span>Start:</span>
                    <span className="text-white">{formatDate(task.start)}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span>End:</span>
                    <span className="text-white">{formatDate(task.end)}</span>
                </div>
                {task.progress !== undefined && (
                    <div className="flex justify-between gap-4">
                        <span>Progress:</span>
                        <span className="text-white">{task.progress}%</span>
                    </div>
                )}
            </div>
            {task.type === 'project' && (
                <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400 text-[10px]">
                    Click to expand/collapse
                </div>
            )}
        </div>
    );
};

interface TaskListHeaderProps {
    headerHeight: number;
    fontFamily: string;
    fontSize: string;
    rowWidth: string;
}

const TaskListHeader = ({ headerHeight }: TaskListHeaderProps) => (
    <div
        className="flex items-center px-3 bg-slate-50 border-b border-slate-200 font-medium text-sm text-slate-600"
        style={{ height: headerHeight }}
    >
        Task
    </div>
);

interface TaskListTableProps {
    tasks: LibraryTask[];
    rowHeight: number;
    rowWidth: string;
    fontFamily: string;
    fontSize: string;
    locale: string;
    selectedTaskId: string;
    setSelectedTask: (taskId: string) => void;
    onExpanderClick: (task: LibraryTask) => void;
}

const TaskListTable = ({
    tasks,
    rowHeight,
    selectedTaskId,
    setSelectedTask,
    onExpanderClick
}: TaskListTableProps) => (
    <div className="overflow-hidden">
        {tasks.map(task => {
            const isSelected = task.id === selectedTaskId;
            const isProject = task.type === 'project';
            const depth = task.project ? 1 : 0;

            return (
                <div
                    key={task.id}
                    className={`
                        flex items-center gap-2 px-3 border-b border-slate-100 cursor-pointer
                        transition-colors duration-100
                        ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}
                    `}
                    style={{
                        height: rowHeight,
                        paddingLeft: `${12 + depth * 16}px`
                    }}
                    onClick={() => setSelectedTask(task.id)}
                >
                    {isProject && (
                        <button
                            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                onExpanderClick(task);
                            }}
                        >
                            <svg
                                className={`w-3 h-3 transition-transform ${task.hideChildren ? '' : 'rotate-90'}`}
                                viewBox="0 0 6 10"
                                fill="currentColor"
                            >
                                <path d="M0 0 L6 5 L0 10 Z" />
                            </svg>
                        </button>
                    )}
                    <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: task.styles?.backgroundColor || '#6366f1' }}
                    />
                    <span className={`truncate text-sm ${isProject ? 'font-medium' : ''}`}>
                        {task.name}
                    </span>
                </div>
            );
        })}
    </div>
);

// ============================================================================
// COMPONENT
// ============================================================================

export function TimelineWrapper({
    mode = 'gantt',
    projection,
    project,
    children,
    records,
    recordFieldMapping,
    unclassifiedRecordHandling,
    adapterOptions = {},
    selection,
    onSelectionChange,
    onItemClick,
    onItemDoubleClick,
    onDateChange,
    onProgressChange,
    onProjectionChange,
    viewMode: controlledViewMode,
    onViewModeChange,
    className = '',
    rowHeight = 50,
    columnWidth = 60,
    headerHeight = 50,
}: TimelineWrapperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [internalViewMode, setInternalViewMode] = useState<ViewMode>(ViewMode.Day);
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');

    // Silence unused state setter - reserved for future view mode selector UI
    void setInternalViewMode;

    // Merge record props into adapter options
    const mergedAdapterOptions = useMemo<GanttAdapterOptions>(() => ({
        ...adapterOptions,
        // Record props override adapterOptions if provided
        ...(records && { records }),
        ...(recordFieldMapping && { recordFieldMapping }),
        ...(unclassifiedRecordHandling && { unclassifiedRecordHandling }),
    }), [adapterOptions, records, recordFieldMapping, unclassifiedRecordHandling]);

    // Map data to our clean render output
    const renderOutput = useMemo<GanttRenderOutput>(() => {
        if (projection) {
            return renderProjection(projection, mergedAdapterOptions);
        }
        if (project && children) {
            return renderHierarchy(project, children, mergedAdapterOptions);
        }
        // Empty state
        return {
            items: [],
            viewMode: ViewMode.Day,
            viewDate: new Date()
        };
    }, [projection, project, children, mergedAdapterOptions]);

    // Internal state: library tasks (quarantined)
    const [libraryTasks, setLibraryTasks] = useState<LibraryTask[]>(() =>
        toLibraryFormat(renderOutput.items)
    );
    const prevRenderItemsRef = useRef(renderOutput.items);

    // Sync library tasks when render output changes from parent
    useEffect(() => {
        if (renderOutput.items !== prevRenderItemsRef.current) {
            prevRenderItemsRef.current = renderOutput.items;
            setLibraryTasks(toLibraryFormat(renderOutput.items));
        }
    }, [renderOutput.items]);

    // View mode: prefer controlled, then internal, then data-suggested
    const viewMode = controlledViewMode ?? internalViewMode ?? renderOutput.viewMode;
    // Note: handleViewModeChange reserved for future view mode selector UI
    // Uncomment when view mode UI is added:
    // const handleViewModeChange = useCallback((mode: ViewMode) => {
    //     if (onViewModeChange) {
    //         onViewModeChange(mode);
    //     } else {
    //         setInternalViewMode(mode);
    //     }
    // }, [onViewModeChange]);
    void onViewModeChange; // Silence unused prop warning until view mode UI is added

    // Selection sync - use ref to avoid stale closure in handleSelect
    const selectionRef = useRef<GanttSelection | undefined>(selection);
    const prevSelectionRef = useRef(selection);
    useEffect(() => {
        if (selection !== prevSelectionRef.current) {
            prevSelectionRef.current = selection;
            selectionRef.current = selection;
            if (selection?.selectedItemIds?.length) {
                setSelectedTaskId(selection.selectedItemIds[0]);
            } else {
                setSelectedTaskId('');
            }
        }
    }, [selection]);

    // Library callback wrapper - translates library Task to our domain
    const handleSelect = useCallback((libraryTask: LibraryTask, isSelected: boolean) => {
        const currentSelection = selectionRef.current?.selectedItemIds ?? [];
        let newSelectedIds: string[];

        if (isSelected) {
            // Single-select: always set to exactly this item (library limitation)
            newSelectedIds = [libraryTask.id];
        } else {
            // Remove from selection
            newSelectedIds = currentSelection.filter(id => id !== libraryTask.id);
        }

        setSelectedTaskId(newSelectedIds[0] ?? '');
        if (onSelectionChange) {
            onSelectionChange({
                ...(selectionRef.current ?? {}),
                selectedItemIds: newSelectedIds
            });
        }
        // Always fire click callback regardless of selection state
        if (onItemClick) {
            onItemClick(fromLibraryFormat(libraryTask));
        }
    }, [onSelectionChange, onItemClick]);

    // Item mutations - library callbacks translated to our domain
    // Use functional state updaters to avoid stale closure issues with rapid changes
    const handleDateChange = useCallback((libraryTask: LibraryTask) => {
        setLibraryTasks(prev => {
            const newLibraryTasks = prev.map(t =>
                t.id === libraryTask.id ? { ...t, start: libraryTask.start, end: libraryTask.end } : t
            );

            // Sync projection for WYSIWYG PDF (inside updater to use fresh state)
            if (onProjectionChange && project) {
                const items = newLibraryTasks.map(fromLibraryFormat);
                const newProjection = projectionFromRender(
                    { items, viewMode: renderOutput.viewMode, viewDate: renderOutput.viewDate },
                    project.id
                );
                // Schedule projection update outside state update
                queueMicrotask(() => onProjectionChange(newProjection));
            }

            return newLibraryTasks;
        });

        if (onDateChange) {
            onDateChange(fromLibraryFormat(libraryTask), libraryTask.start, libraryTask.end);
        }
    }, [onDateChange, onProjectionChange, project, renderOutput.viewMode, renderOutput.viewDate]);

    const handleProgressChange = useCallback((libraryTask: LibraryTask) => {
        setLibraryTasks(prev =>
            prev.map(t =>
                t.id === libraryTask.id ? { ...t, progress: libraryTask.progress } : t
            )
        );

        if (onProgressChange) {
            onProgressChange(fromLibraryFormat(libraryTask), libraryTask.progress);
        }
    }, [onProgressChange]);

    const handleExpanderClick = useCallback((libraryTask: LibraryTask) => {
        setLibraryTasks(prev =>
            prev.map(t =>
                t.id === libraryTask.id ? { ...t, hideChildren: !t.hideChildren } : t
            )
        );
    }, []);

    const handleDoubleClick = useCallback((libraryTask: LibraryTask) => {
        if (onItemDoubleClick) {
            onItemDoubleClick(fromLibraryFormat(libraryTask));
        }
    }, [onItemDoubleClick]);

    // Styling options
    const styling: StylingOption = useMemo(() => ({
        headerHeight,
        rowHeight,
        columnWidth,
        listCellWidth: mode === 'log' ? '0' : '200px', // Hide sidebar in log mode
        barCornerRadius: 4,
        barFill: 75,
        handleWidth: 8,
        fontFamily: 'inherit',
        fontSize: '14px',
        arrowColor: '#94a3b8',
        arrowIndent: 20,
        todayColor: 'rgba(59, 130, 246, 0.1)',
        TooltipContent,
        TaskListHeader: mode === 'log' ? () => null : TaskListHeader,
        TaskListTable: mode === 'log' ? () => null : (props: TaskListTableProps) => (
            <TaskListTable
                {...props}
                selectedTaskId={selectedTaskId}
                setSelectedTask={(id) => {
                    const task = libraryTasks.find(t => t.id === id);
                    if (task) handleSelect(task, true);
                }}
                onExpanderClick={handleExpanderClick}
            />
        ),
    }), [mode, headerHeight, rowHeight, columnWidth, selectedTaskId, libraryTasks, handleSelect, handleExpanderClick]);

    // Empty state
    if (libraryTasks.length === 0) {
        return (
            <div className={`flex items-center justify-center h-full text-slate-400 ${className}`}>
                No items to display
            </div>
        );
    }

    // CSP NOTE: The inline <style> below may be blocked by strict Content Security Policy.
    // For CSP-strict deployments, move these rules to an external stylesheet:
    //   .gantt-wrapper ._1nBOt { background: var(--gantt-header-bg, #f8fafc) !important; }
    //   .gantt-wrapper ._34SS0 { stroke: var(--gantt-border, #e2e8f0) !important; }
    //   .gantt-wrapper ._9w8d5 { fill: #1e293b !important; font-family: inherit !important; }
    //   .gantt-wrapper ._WuQ0f { stroke-width: 1.5 !important; }
    return (
        <div
            ref={containerRef}
            className={`gantt-wrapper gantt-theme-overrides overflow-auto ${className}`}
            style={{
                // CSS custom properties for theme customization
                ['--gantt-header-bg' as string]: '#f8fafc',
                ['--gantt-border' as string]: '#e2e8f0',
            }}
        >
            <style>{`
                .gantt-wrapper ._1nBOt { background: var(--gantt-header-bg, #f8fafc) !important; }
                .gantt-wrapper ._34SS0 { stroke: var(--gantt-border, #e2e8f0) !important; }
                .gantt-wrapper ._9w8d5 { fill: #1e293b !important; font-family: inherit !important; }
                .gantt-wrapper ._WuQ0f { stroke-width: 1.5 !important; }
            `}</style>
            <Gantt
                tasks={libraryTasks}
                viewMode={viewMode}
                viewDate={renderOutput.viewDate}
                onSelect={handleSelect}
                onDateChange={handleDateChange}
                onProgressChange={handleProgressChange}
                onDoubleClick={handleDoubleClick}
                onExpanderClick={handleExpanderClick}
                {...styling}
            />
        </div>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export library's ViewMode (it's fine - not "Task" terminology)
export { ViewMode };

// Export our clean types (NOT the library's Task type)
export type { GanttRenderItem, GanttRenderOutput, GanttAdapterOptions };
