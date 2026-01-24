/**
 * TimelineWrapper
 *
 * Adapter component that wraps gantt-task-react with Tailwind-friendly
 * customization. Provides a unified interface for both Gantt View
 * (with dependencies/sidebar) and Project Log (minimal timeline).
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Gantt, Task, ViewMode, StylingOption } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import type { HierarchyNode, GanttProjectionOutput, GanttSelection } from '@autoart/shared';
import {
    mapHierarchyToTasks,
    mapProjectionToTasks,
    tasksToProjection,
    GanttTaskAdapterOptions,
    MappedGanttData
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

    /** Adapter options for mapping */
    adapterOptions?: GanttTaskAdapterOptions;

    /** Selection state (controlled) */
    selection?: GanttSelection;
    onSelectionChange?: (selection: GanttSelection) => void;

    /** Task events */
    onTaskClick?: (task: Task) => void;
    onTaskDoubleClick?: (task: Task) => void;
    onDateChange?: (task: Task, start: Date, end: Date) => void;
    onProgressChange?: (task: Task, progress: number) => void;

    /** For WYSIWYG PDF sync - called when tasks change */
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
    task: Task;
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
    tasks: Task[];
    rowHeight: number;
    rowWidth: string;
    fontFamily: string;
    fontSize: string;
    locale: string;
    selectedTaskId: string;
    setSelectedTask: (taskId: string) => void;
    onExpanderClick: (task: Task) => void;
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
    adapterOptions = {},
    selection,
    onSelectionChange,
    onTaskClick,
    onTaskDoubleClick,
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
    const [internalViewMode, setInternalViewMode] = useState<ViewMode>('Day');
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');

    // Map data to tasks
    const mappedData = useMemo<MappedGanttData>(() => {
        if (projection) {
            return mapProjectionToTasks(projection, adapterOptions);
        }
        if (project && children) {
            return mapHierarchyToTasks(project, children, adapterOptions);
        }
        // Empty state
        return {
            tasks: [],
            viewMode: 'Day',
            viewDate: new Date()
        };
    }, [projection, project, children, adapterOptions]);

    // Task state for interactivity
    const [tasks, setTasks] = useState<Task[]>(mappedData.tasks);

    // Sync tasks when data changes
    useEffect(() => {
        setTasks(mappedData.tasks);
    }, [mappedData.tasks]);

    // View mode
    const viewMode = controlledViewMode ?? internalViewMode;
    const handleViewModeChange = useCallback((mode: ViewMode) => {
        if (onViewModeChange) {
            onViewModeChange(mode);
        } else {
            setInternalViewMode(mode);
        }
    }, [onViewModeChange]);

    // Selection sync
    useEffect(() => {
        if (selection?.selectedItemIds?.length) {
            setSelectedTaskId(selection.selectedItemIds[0]);
        }
    }, [selection]);

    const handleSelect = useCallback((task: Task, isSelected: boolean) => {
        setSelectedTaskId(isSelected ? task.id : '');
        if (onSelectionChange) {
            onSelectionChange({
                ...selection,
                selectedItemIds: isSelected ? [task.id] : []
            });
        }
        if (onTaskClick && isSelected) {
            onTaskClick(task);
        }
    }, [selection, onSelectionChange, onTaskClick]);

    // Task mutations
    const handleDateChange = useCallback((task: Task) => {
        const newTasks = tasks.map(t =>
            t.id === task.id ? { ...t, start: task.start, end: task.end } : t
        );
        setTasks(newTasks);

        if (onDateChange) {
            onDateChange(task, task.start, task.end);
        }

        // Sync projection for WYSIWYG PDF
        if (onProjectionChange && project) {
            const newProjection = tasksToProjection(newTasks, project.id);
            onProjectionChange(newProjection);
        }
    }, [tasks, onDateChange, onProjectionChange, project]);

    const handleProgressChange = useCallback((task: Task) => {
        const newTasks = tasks.map(t =>
            t.id === task.id ? { ...t, progress: task.progress } : t
        );
        setTasks(newTasks);

        if (onProgressChange) {
            onProgressChange(task, task.progress);
        }
    }, [tasks, onProgressChange]);

    const handleExpanderClick = useCallback((task: Task) => {
        setTasks(tasks.map(t =>
            t.id === task.id ? { ...t, hideChildren: !t.hideChildren } : t
        ));
    }, [tasks]);

    const handleDoubleClick = useCallback((task: Task) => {
        if (onTaskDoubleClick) {
            onTaskDoubleClick(task);
        }
    }, [onTaskDoubleClick]);

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
                    const task = tasks.find(t => t.id === id);
                    if (task) handleSelect(task, true);
                }}
                onExpanderClick={handleExpanderClick}
            />
        ),
    }), [mode, headerHeight, rowHeight, columnWidth, selectedTaskId, tasks, handleSelect, handleExpanderClick]);

    // Empty state
    if (tasks.length === 0) {
        return (
            <div className={`flex items-center justify-center h-full text-slate-400 ${className}`}>
                No tasks to display
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`gantt-wrapper overflow-auto ${className}`}
            style={{
                // Override gantt-task-react's default styles
                ['--gantt-header-bg' as string]: '#f8fafc',
                ['--gantt-border' as string]: '#e2e8f0',
            }}
        >
            <style>{`
                .gantt-wrapper ._1nBOt { background: var(--gantt-header-bg) !important; }
                .gantt-wrapper ._34SS0 { stroke: var(--gantt-border) !important; }
                .gantt-wrapper ._9w8d5 { fill: #1e293b !important; font-family: inherit !important; }
                .gantt-wrapper ._WuQ0f { stroke-width: 1.5 !important; }
            `}</style>
            <Gantt
                tasks={tasks}
                viewMode={viewMode}
                viewDate={mappedData.viewDate}
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

export { ViewMode };
export type { Task, MappedGanttData };
