/**
 * ProjectView - Composite for displaying project workflow
 *
 * This is a REUSABLE COMPOSITE for project hierarchy display.
 * It handles:
 * - Subprocess navigation sidebar
 * - Task table (via DataTableHierarchy)
 * - Classified record tables (via DataTableFlat)
 * - Selection and drawer interactions
 *
 * For page-level usage, see ProjectPage which wraps this with layout.
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ProjectLogView } from './ProjectLogView';
import { useProjectTree, useRecordDefinitions, useRecords } from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import { DataTableHierarchy, type HierarchyFieldDef } from './DataTableHierarchy';
import { DataTableFlat } from './DataTableFlat';
import type { HierarchyNode, DataRecord, RecordDefinition } from '../../types';
import type { DataFieldKind } from '../molecules/DataFieldWidget';

// ==================== TYPES ====================

export interface ProjectViewProps {
    /** Project ID to display */
    projectId: string | null;
    /** Additional className */
    className?: string;
}

// ==================== HELPERS ====================

/**
 * Extract metadata from a node, parsing JSON string if needed
 */
function getNodeMetadata(node: HierarchyNode): Record<string, unknown> {
    if (typeof node.metadata === 'string') {
        try {
            const parsed = JSON.parse(node.metadata);
            return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
        } catch {
            return {};
        }
    }
    return (node.metadata as Record<string, unknown>) || {};
}

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
    // Tab state for switching between Workflow and Log views
    const [activeTab, setActiveTab] = useState<'workflow' | 'log'>('workflow');

    // Subscribe to nodes directly to ensure reactivity when nodes are updated
    const storeNodes = useHierarchyStore((state) => state.nodes);
    const setNodes = useHierarchyStore((state) => state.setNodes);
    const getNode = useHierarchyStore((state) => state.getNode);
    const getChildren = useHierarchyStore((state) => state.getChildren);
    const { selection, inspectNode, setInspectorMode, openDrawer, inspectRecord } = useUIStore();

    // Fetch record definitions to get Task schema
    const { data: definitions } = useRecordDefinitions();

    // Get Task definition fields directly from the database
    const taskFields = useMemo<HierarchyFieldDef[]>(() => {
        const taskDef = definitions?.find((d) => d.name === 'Task');
        if (!taskDef?.schema_config?.fields) {
            return [];
        }

        // Convert definition fields to HierarchyFieldDef format
        return taskDef.schema_config.fields.map((field): HierarchyFieldDef => {
            // Determine display properties based on field type
            const isCollapsedField = ['title', 'status', 'owner', 'dueDate'].includes(field.key);
            const width = field.key === 'title' ? 360 :
                field.type === 'status' ? 128 :
                    field.type === 'user' ? 96 :
                        field.type === 'date' ? 160 : 'flex';

            return {
                key: field.key,
                label: field.label,
                type: field.type,
                options: field.options,
                renderAs: (field.type === 'status' ? 'status' :
                    field.type === 'user' ? 'user' :
                        field.type === 'date' ? 'date' :
                            field.type === 'tags' ? 'tags' :
                                field.type === 'textarea' ? 'description' : 'text') as DataFieldKind,
                showInCollapsed: isCollapsedField,
                showInExpanded: field.key !== 'title', // All except title show in expanded
                width,
            };
        });
    }, [definitions]);

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
        if (selectedNode.type === 'task') return selectedNode.parent_id;
        return subprocesses[0]?.id || null;
    }, [selectedNode, subprocesses]);

    const activeSubprocess = activeSubprocessId ? getNode(activeSubprocessId) : null;

    const activeSubprocessMeta = useMemo(() => {
        if (!activeSubprocess) return null;
        return getNodeMetadata(activeSubprocess);
    }, [activeSubprocess]);

    const fallbacks = useMemo(() => ({
        owner: activeSubprocessMeta && typeof activeSubprocessMeta.lead === 'string' ? activeSubprocessMeta.lead : undefined,
        dueDate: activeSubprocessMeta && typeof activeSubprocessMeta.dueDate === 'string' ? activeSubprocessMeta.dueDate : undefined,
    }), [activeSubprocessMeta]);

    const tasks = useMemo(() => {
        if (!activeSubprocessId) return [];
        return getChildren(activeSubprocessId).filter((n) => n.type === 'task');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSubprocessId, getChildren, storeNodes]);

    // Fetch records classified under this subprocess (excluding tasks which are nodes)
    const { data: subprocessRecords = [] } = useRecords(
        activeSubprocessId ? { classificationNodeId: activeSubprocessId } : undefined
    );

    // Group records by their definition for floating tables
    const recordsByDefinition = useMemo(() => {
        const groups: Map<string, { definition: RecordDefinition; records: DataRecord[] }> = new Map();

        for (const record of subprocessRecords) {
            const defId = record.definition_id;
            const def = definitions?.find((d) => d.id === defId);

            // Skip if no definition found or if it's a Task definition (tasks are rendered as nodes)
            if (!def || def.name === 'Task') continue;

            if (!groups.has(defId)) {
                groups.set(defId, { definition: def, records: [] });
            }
            groups.get(defId)!.records.push(record);
        }

        return Array.from(groups.values());
    }, [subprocessRecords, definitions]);

    // Selected record ID for floating tables
    const selectedRecordId = selection?.type === 'record' ? selection.id : null;

    // Handlers
    const handleSelectSubprocess = (subprocessId: string) => {
        setInspectorMode('record');
        inspectNode(subprocessId);
    };

    const handleSelectTask = (taskId: string) => {
        setInspectorMode('record');
        inspectNode(taskId);
    };

    const handleAddTask = () => {
        if (activeSubprocessId) {
            openDrawer('create-node', { parentId: activeSubprocessId, nodeType: 'task' });
        }
    };

    const handleSelectRecord = (recordId: string) => {
        inspectRecord(recordId);
        setInspectorMode('record');
    };

    const handleAddRecord = (definitionId: string) => {
        openDrawer('create-record', {
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
                    {/* Tab Switcher */}
                    <div className="flex gap-1 mt-2">
                        <button
                            onClick={() => setActiveTab('workflow')}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                activeTab === 'workflow'
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Workflow
                        </button>
                        <button
                            onClick={() => setActiveTab('log')}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                activeTab === 'log'
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Log
                        </button>
                    </div>
                </div>

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
                    {activeSubprocessId && (
                        <button
                            onClick={handleAddTask}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            data-aa-component="ProjectView"
                            data-aa-id="add-task"
                            data-aa-action="create"
                        >
                            <Plus size={16} />
                            Add Task
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-auto custom-scroll p-4">
                    <div className="min-w-[900px] space-y-6">
                        {/* Task Table - using DataTableHierarchy */}
                        <DataTableHierarchy
                            nodes={tasks}
                            fields={taskFields}
                            fallbacks={fallbacks}
                            selectedNodeId={selectedNodeId}
                            onRowSelect={handleSelectTask}
                            onAddNode={handleAddTask}
                            showStatusSummary
                            emptyMessage="No tasks in this subprocess"
                        />

                        {/* Floating Record Tables - per definition */}
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
            ) : (
                <ProjectLogView projectId={projectId} />
            )}
        </div>
    );
}
