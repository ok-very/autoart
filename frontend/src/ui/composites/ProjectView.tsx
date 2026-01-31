/**
 * ProjectView - Composite for displaying project workflow
 *
 * This is a REUSABLE COMPOSITE for project hierarchy display.
 * It handles:
 * - Subprocess navigation sidebar
 * - Action registry (via ActionRegistryTable)
 * - Classified record tables (via DataTableFlat)
 * - Selection and drawer interactions
 *
 * For page-level usage, see ProjectPage which wraps this with layout.
 */

import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { DataTableFlat } from './DataTableFlat';
import { GanttView } from './GanttView';
import { ProjectLogView } from './ProjectLogView';
import { CalendarView } from './CalendarView';
import { GanttFilters } from '../components/GanttFilters';
import {
    mapActionsToGantt,
    actionToProjectionInput,
    extractUniqueStatuses,
    extractUniqueAssignees,
    extractDateRange,
    type TimelineFilter,
} from '../../utils/timeline-mapper';
import { actionsToCalendarEvents } from '../../utils/calendar-adapter';
import { useProjectTree, useRecordDefinitions, useRecords, useActions, useRescheduleAction } from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import type { HierarchyNode, DataRecord, RecordDefinition } from '../../types';
import { SegmentedControl } from '@autoart/ui';

// ==================== TYPES ====================

export interface ProjectViewProps {
    /** Project ID to display */
    projectId: string | null;
    /** Additional className */
    className?: string;
}

// ==================== HELPERS ====================

/**
 * Collect subprocesses from a project hierarchy
 */
function collectSubprocesses(
    project: HierarchyNode,
    getChildren: (id: string | null) => HierarchyNode[]
): HierarchyNode[] {
    const processes = getChildren(project.id).filter((n) => n.type === 'process');
    const subprocesses: HierarchyNode[] = [];

    for (const process of processes) {
        const stages = getChildren(process.id).filter((n) => n.type === 'stage');
        for (const stage of stages) {
            subprocesses.push(...getChildren(stage.id).filter((n) => n.type === 'subprocess'));
        }
    }

    return subprocesses;
}

// ==================== PROJECT VIEW ====================

export function ProjectView({ projectId, className }: ProjectViewProps) {
    // Tab state for switching between Workflow, Gantt, Calendar, and Log views
    const [activeTab, setActiveTab] = useState<'workflow' | 'gantt' | 'calendar' | 'log'>('workflow');

    // Gantt filter state
    const [ganttFilter, setGanttFilter] = useState<TimelineFilter>({});

    // Subscribe to nodes directly to ensure reactivity when nodes are updated
    const storeNodes = useHierarchyStore((state) => state.nodes);
    const setNodes = useHierarchyStore((state) => state.setNodes);
    const getNode = useHierarchyStore((state) => state.getNode);
    const getChildren = useHierarchyStore((state) => state.getChildren);
    const { selection, inspectNode, inspectAction, setInspectorMode, openOverlay, inspectRecord } = useUIStore();

    // Fetch record definitions
    const { data: definitions } = useRecordDefinitions();

    // Ensure we still load the hierarchy even when the outer sidebar is hidden
    const { data: queryNodes } = useProjectTree(projectId);
    useEffect(() => {
        if (queryNodes) setNodes(queryNodes);
    }, [queryNodes, setNodes]);

    const project = projectId ? getNode(projectId) : null;

    const subprocesses = useMemo(() => {
        if (!project) return [];
        return collectSubprocesses(project, getChildren);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project, getChildren, storeNodes]);

    const selectedNodeId = selection?.type === 'node' ? selection.id : null;
    const selectedNode = selectedNodeId ? getNode(selectedNodeId) : null;

    const activeSubprocessId = useMemo(() => {
        if (!selectedNode) return subprocesses[0]?.id || null;
        if (selectedNode.type === 'subprocess') return selectedNode.id;
        return subprocesses[0]?.id || null;
    }, [selectedNode, subprocesses]);

    const activeSubprocess = activeSubprocessId ? getNode(activeSubprocessId) : null;

    // Fetch records classified under this subprocess
    const { data: subprocessRecords = [] } = useRecords(
        activeSubprocessId ? { classificationNodeId: activeSubprocessId } : undefined
    );

    // Group records by their definition for floating tables
    const recordsByDefinition = useMemo(() => {
        const groups: Map<string, { definition: RecordDefinition; records: DataRecord[] }> = new Map();

        for (const record of subprocessRecords) {
            const defId = record.definition_id;
            const def = definitions?.find((d) => d.id === defId);

            if (!def) continue;

            if (!groups.has(defId)) {
                groups.set(defId, { definition: def, records: [] });
            }
            groups.get(defId)!.records.push(record);
        }

        return Array.from(groups.values());
    }, [subprocessRecords, definitions]);

    // Fetch actions for the project (for Gantt view)
    const { data: projectActions = [] } = useActions(projectId, 'project');

    // Convert actions to projection input format for filter helpers
    const actionInputs = useMemo(() => {
        return projectActions.map(a => actionToProjectionInput(a));
    }, [projectActions]);

    // Extract filter options from actions
    const availableStatuses = useMemo(() => extractUniqueStatuses(actionInputs), [actionInputs]);
    const availableAssignees = useMemo(() => extractUniqueAssignees(actionInputs), [actionInputs]);
    const dateRangeBounds = useMemo(() => extractDateRange(actionInputs), [actionInputs]);

    // Memoize the Gantt Projection from Actions
    const ganttProjection = useMemo(() => {
        if (!project || activeTab !== 'gantt') return null;
        if (projectActions.length === 0) return null;

        // Map actions to Gantt projection with filtering
        return mapActionsToGantt(projectActions, project.id, ganttFilter);
    }, [project, projectActions, activeTab, ganttFilter]);

    // Calendar events conversion
    const calendarEvents = useMemo(() => {
        if (activeTab !== 'calendar' || projectActions.length === 0) return [];
        return actionsToCalendarEvents(actionInputs);
    }, [activeTab, projectActions, actionInputs]);

    // Reschedule mutation for calendar/gantt drag-and-drop
    const rescheduleAction = useRescheduleAction();

    // Selected record ID for floating tables
    const selectedRecordId = selection?.type === 'record' ? selection.id : null;

    // Handlers
    const handleSelectSubprocess = (subprocessId: string) => {
        setInspectorMode('record');
        inspectNode(subprocessId);
    };

    const handleSelectRecord = (recordId: string) => {
        inspectRecord(recordId);
        setInspectorMode('record');
    };

    const handleAddRecord = (definitionId: string) => {
        openOverlay('create-record', {
            definitionId,
            classificationNodeId: activeSubprocessId,
        });
    };

    // Empty states
    if (!projectId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
                <div className="text-center">
                    <p className="text-lg font-medium">No project selected</p>
                    <p className="text-sm">Select a project from the top menu</p>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
                <div className="text-center">
                    <p className="text-lg font-medium">Loading project…</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex-1 flex overflow-hidden bg-white ${className || ''}`}
            data-aa-component="ProjectView"
            data-aa-view={activeTab}
        >
            {/* Left navigation (subprocess list) */}
            <aside className="w-[320px] shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
                <div className="p-3 border-b border-slate-200 bg-white">
                    <div className="text-sm font-semibold text-slate-800 truncate" title={project.title}>
                        {project.title}
                    </div>
                    {/* View Switcher */}
                    <SegmentedControl
                        size="xs"
                        value={activeTab}
                        onChange={(value) => {
                            const validTabs = ['workflow', 'gantt', 'calendar', 'log'] as const;
                            if (validTabs.includes(value as typeof validTabs[number])) {
                                setActiveTab(value as typeof validTabs[number]);
                            }
                        }}
                        data={[
                            { value: 'workflow', label: 'Workflow' },
                            { value: 'gantt', label: 'Gantt' },
                            { value: 'calendar', label: 'Calendar' },
                            { value: 'log', label: 'Log' },
                        ]}
                        className="mt-2"
                    />
                </div>

                {/* Subprocess Sidebar Content - Only show for Workflow tab */}
                {activeTab === 'workflow' && (
                    <div className="flex-1 overflow-y-auto p-2 custom-scroll">
                        {subprocesses.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400">No subprocesses yet.</div>
                        ) : (
                            <div className="space-y-1">
                                {subprocesses.map((sp) => {
                                    const isActive = sp.id === activeSubprocessId;
                                    return (
                                        <button
                                            key={sp.id}
                                            onClick={() => handleSelectSubprocess(sp.id)}
                                            className={
                                                isActive
                                                    ? 'w-full text-left px-3 py-2 rounded bg-blue-50 text-blue-700 border border-blue-100'
                                                    : 'w-full text-left px-3 py-2 rounded hover:bg-white text-slate-700 border border-transparent'
                                            }
                                            data-aa-component="ProjectView"
                                            data-aa-id={`subprocess-${sp.id}`}
                                            data-aa-action="select-subprocess"
                                        >
                                            <div className="text-xs font-semibold truncate" title={sp.title}>
                                                {sp.title}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Gantt Sidebar Content */}
                {activeTab === 'gantt' && (
                    <div className="flex-1 overflow-y-auto p-3 custom-scroll">
                        <p className="text-xs font-semibold text-slate-700 mb-3">Timeline Controls</p>
                        <GanttFilters
                            filter={ganttFilter}
                            onFilterChange={setGanttFilter}
                            availableStatuses={availableStatuses}
                            availableAssignees={availableAssignees}
                            dateRange={dateRangeBounds}
                        />
                        {projectActions.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-200">
                                <p className="text-[10px] text-slate-400">
                                    {projectActions.length} action{projectActions.length !== 1 ? 's' : ''} in project
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Calendar Sidebar Content */}
                {activeTab === 'calendar' && (
                    <div className="flex-1 overflow-y-auto p-3 custom-scroll">
                        <p className="text-xs font-semibold text-slate-700 mb-3">Calendar View</p>
                        <p className="text-xs text-slate-500 mb-4">
                            Drag events to reschedule. Hover near edges during drag to navigate months.
                        </p>
                        {projectActions.length > 0 && (
                            <div className="pt-3 border-t border-slate-200">
                                <p className="text-[10px] text-slate-400">
                                    {calendarEvents.length} scheduled action{calendarEvents.length !== 1 ? 's' : ''}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {projectActions.length - calendarEvents.length} without dates
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'log' && (
                    <div className="flex-1 p-4">
                        <p className="text-xs font-medium text-slate-600 mb-2">Execution Log</p>
                        <p className="text-xs text-slate-400">Timeline of all actions and events for this project.</p>
                    </div>
                )}
            </aside>

            {/* Main content area */}
            {activeTab === 'workflow' ? (
                <main className="flex-1 flex flex-col overflow-hidden">
                    <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between">
                        <div className="min-w-0">
                            <div className="text-xs text-slate-400">Subprocess</div>
                            <div className="text-sm font-semibold text-slate-800 truncate">
                                {activeSubprocess?.title || 'Select a subprocess'}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scroll p-4">
                        <div className="min-w-[900px] space-y-6">
                            {/* Record Tables - per definition */}
                            {recordsByDefinition.map(({ definition, records }) => (
                                <div key={definition.id} className="mt-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                            {definition.styling?.icon && <span>{definition.styling.icon}</span>}
                                            {definition.name}
                                            <span className="text-xs font-normal text-slate-400">
                                                ({records.length})
                                            </span>
                                        </h3>
                                        <button
                                            onClick={() => handleAddRecord(definition.id)}
                                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            data-aa-component="ProjectView"
                                            data-aa-id={`add-record-${definition.id}`}
                                            data-aa-action="create-record"
                                        >
                                            <Plus size={12} />
                                            Add
                                        </button>
                                    </div>
                                    <DataTableFlat
                                        records={records}
                                        definition={definition}
                                        selectedRecordId={selectedRecordId}
                                        onRowSelect={handleSelectRecord}
                                        compact
                                        emptyMessage={`No ${definition.name.toLowerCase()}s classified here`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            ) : activeTab === 'gantt' ? (
                <main className="flex-1 flex flex-col overflow-hidden">
                    {ganttProjection ? (
                        <GanttView
                            projection={ganttProjection}
                            projectId={projectId}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">
                            Loading Gantt...
                        </div>
                    )}
                </main>
            ) : activeTab === 'calendar' ? (
                <main className="flex-1 flex flex-col overflow-hidden p-4">
                    {calendarEvents.length > 0 ? (
                        <CalendarView
                            events={calendarEvents}
                            onEventDrop={({ event, start, end }) => {
                                rescheduleAction.mutate({
                                    actionId: event.actionId,
                                    startDate: start.toISOString(),
                                    dueDate: end.toISOString(),
                                });
                            }}
                            onEventResize={({ event, start, end }) => {
                                rescheduleAction.mutate({
                                    actionId: event.actionId,
                                    startDate: start.toISOString(),
                                    dueDate: end.toISOString(),
                                });
                            }}
                            onSelectEvent={(event) => {
                                // Check if this action has a corresponding hierarchy node
                                const node = storeNodes[event.actionId];
                                if (node) {
                                    setInspectorMode('record');
                                    inspectNode(event.actionId);
                                } else {
                                    // For actions without hierarchy nodes, use action inspector
                                    inspectAction(event.actionId);
                                }
                            }}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">
                            <div className="text-center">
                                <p className="text-lg font-medium">No scheduled actions</p>
                                <p className="text-sm mt-1">Add dates to actions to see them on the calendar</p>
                            </div>
                        </div>
                    )}
                </main>
            ) : (
                <ProjectLogView projectId={projectId} />
            )}
        </div>
    );
}
