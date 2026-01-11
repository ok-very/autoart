import { Plus, ChevronDown, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useCallback, useState } from 'react';

import type { DerivedStatus } from '@autoart/shared';

import {
    useProjectTree,
    useRecordDefinitions,
    useRecords,
    useUpdateNode,
    useUpdateRecord,
    useWorkflowSurfaceNodes,
    useStartWork,
    useStopWork,
    useFinishWork,
    useBlockWork,
    useUnblockWork,
    useRecordFieldValue,
} from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import type { HierarchyNode, DataRecord, RecordDefinition } from '../../types';
import { DataTableFlat } from '../../ui/composites/DataTableFlat';
import { DataTableHierarchy, type HierarchyFieldDef } from '../../ui/composites/DataTableHierarchy';
import { WorkflowSurfaceTable } from '../../ui/composites/WorkflowSurfaceTable';
import { deriveTaskStatus, TASK_STATUS_CONFIG } from '../../utils/nodeMetadata';
import { ComposerSurface } from '../composer';

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
 * Collect subprocesses under a process.
 *
 * Stages are projections now, so the default mapping is:
 *   process -> subprocess
 *
 * However, seed/test data may still include stage nodes, so fall back to:
 *   process -> stage -> subprocess
 */
function collectSubprocessesForProcess(
    process: HierarchyNode,
    getChildren: (id: string | null) => HierarchyNode[]
): HierarchyNode[] {
    const directSubprocesses = getChildren(process.id).filter((n) => n.type === 'subprocess');
    if (directSubprocesses.length > 0) return directSubprocesses;

    const stages = getChildren(process.id).filter((n) => n.type === 'stage');
    const subprocesses: HierarchyNode[] = [];
    for (const stage of stages) {
        subprocesses.push(...getChildren(stage.id).filter((n) => n.type === 'subprocess'));
    }
    return subprocesses;
}

/**
 * Collect subprocesses from a project hierarchy (across all processes).
 */
function collectSubprocesses(
    project: HierarchyNode,
    getChildren: (id: string | null) => HierarchyNode[]
): HierarchyNode[] {
    const processes = getChildren(project.id).filter((n) => n.type === 'process');
    const subprocesses: HierarchyNode[] = [];

    for (const process of processes) {
        subprocesses.push(...collectSubprocessesForProcess(process, getChildren));
    }

    return subprocesses;
}

export function ProjectWorkflowView() {
    // Subscribe to nodes directly to ensure reactivity when nodes are updated
    const storeNodes = useHierarchyStore((state) => state.nodes);
    const setNodes = useHierarchyStore((state) => state.setNodes);
    const getNode = useHierarchyStore((state) => state.getNode);
    const getChildren = useHierarchyStore((state) => state.getChildren);
    const { activeProjectId, selection, inspectNode, setInspectorMode, openDrawer } = useUIStore();

    // Fetch record definitions to get Task schema
    const { data: definitions } = useRecordDefinitions();

    // Update node mutation for inline editing
    const updateNode = useUpdateNode();
    const updateRecord = useUpdateRecord();

    // Handle inline cell edits for hierarchy nodes
    const handleCellChange = useCallback(
        (nodeId: string, fieldKey: string, value: unknown) => {
            const node = getNode(nodeId);
            if (!node) return;

            // Handle title separately (it's a top-level field)
            if (fieldKey === 'title') {
                updateNode.mutate({ id: nodeId, title: String(value) });
                return;
            }

            // All other fields go into metadata
            const currentMeta = getNodeMetadata(node);

            // Nomenclature: owner -> assignee (keep both keys so old field defs still display)
            const nextMeta: Record<string, unknown> = { ...currentMeta, [fieldKey]: value };
            if (fieldKey === 'owner' || fieldKey === 'assignee') {
                nextMeta.assignee = value;
                nextMeta.owner = value;
            }

            updateNode.mutate({
                id: nodeId,
                metadata: nextMeta,
            });
        },
        [getNode, updateNode]
    );

    // Get Task definition fields directly from the database
    const taskFields = useMemo<HierarchyFieldDef[]>(() => {
        const taskDef = definitions?.find((d) => d.name === 'Task');
        if (!taskDef?.schema_config?.fields) {
            return [];
        }

        // Convert definition fields to HierarchyFieldDef format
        return taskDef.schema_config.fields.map((field): HierarchyFieldDef => {
            // Determine display properties based on field type
            const isCollapsedField = ['title', 'status', 'assignee', 'owner', 'dueDate'].includes(field.key);
            const width =
                field.key === 'title'
                    ? 280
                    : field.type === 'status'
                        ? 128
                        : field.type === 'user'
                            ? 96
                            : field.type === 'date'
                                ? 160
                                : 130;

            return {
                key: field.key,
                label: field.label,
                type: field.type,
                options: field.options,
                statusConfig: field.statusConfig, // Preserve status config from definition
                renderAs:
                    field.type === 'status'
                        ? 'status'
                        : field.type === 'user'
                            ? 'user'
                            : field.type === 'date'
                                ? 'date'
                                : field.type === 'tags'
                                    ? 'tags'
                                    : field.type === 'textarea'
                                        ? 'description'
                                        : 'text',
                showInCollapsed: isCollapsedField,
                showInExpanded: field.key !== 'title', // All except title show in expanded
                width,
            };
        });
    }, [definitions]);

    // Build status config for DataTableHierarchy from the status field's statusConfig
    const statusConfig = useMemo(() => {
        // Find the status field in taskFields
        const statusField = taskFields.find((f) => f.type === 'status');

        // Use statusConfig from field if available, otherwise fall back to TASK_STATUS_CONFIG
        const sourceConfig = statusField?.statusConfig ?? TASK_STATUS_CONFIG;

        return Object.fromEntries(
            Object.entries(sourceConfig).map(([status, config]) => [
                status,
                { label: config.label, colorClass: config.colorClass.split(' ')[0] }, // Extract just bg-* class
            ])
        );
    }, [taskFields]);

    // Derive status from node (wrapper for deriveTaskStatus which expects TaskMetadata)
    const deriveNodeStatus = useCallback((node: HierarchyNode): string => {
        const meta = getNodeMetadata(node);
        return deriveTaskStatus(meta as Parameters<typeof deriveTaskStatus>[0]);
    }, []);

    // Ensure we still load the hierarchy even when the outer sidebar is hidden.
    const { data: queryNodes } = useProjectTree(activeProjectId);
    useEffect(() => {
        if (queryNodes) setNodes(queryNodes);
    }, [queryNodes, setNodes]);

    const project = activeProjectId ? getNode(activeProjectId) : null;

    // Get all processes for this project
    const processes = useMemo(() => {
        if (!project) return [];
        return getChildren(project.id).filter((n) => n.type === 'process');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project, getChildren, storeNodes]);

    // Track selected process (for multi-process projects)
    const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
    const [isProcessDropdownOpen, setIsProcessDropdownOpen] = useState(false);

    // Auto-select first process when processes change
    useEffect(() => {
        if (processes.length > 0 && (!selectedProcessId || !processes.find((p) => p.id === selectedProcessId))) {
            setSelectedProcessId(processes[0].id);
        }
    }, [processes, selectedProcessId]);

    const selectedProcess = selectedProcessId ? getNode(selectedProcessId) : null;

    // Collect subprocesses - filter by selected process if there are multiple
    const subprocesses = useMemo(() => {
        if (!project) return [];

        // If only one process or no process selected, show all subprocesses
        if (processes.length <= 1 || !selectedProcessId) {
            return collectSubprocesses(project, getChildren);
        }

        // Filter to only subprocesses under the selected process
        const processNode = getNode(selectedProcessId);
        if (!processNode) return [];
        return collectSubprocessesForProcess(processNode, getChildren);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project, getChildren, storeNodes, processes.length, selectedProcessId, getNode]);

    const selectedNodeId = selection?.type === 'node' ? selection.id : null;
    const selectedNode = selectedNodeId ? getNode(selectedNodeId) : null;

    // Track locally selected subprocess (can be changed via sidebar or header dropdown)
    const [localSubprocessId, setLocalSubprocessId] = useState<string | null>(null);
    const [isSubprocessDropdownOpen, setIsSubprocessDropdownOpen] = useState(false);
    const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
    const [isComposerOpen, setIsComposerOpen] = useState(false);

    // Track last focused table for contextual Add button
    // 'tasks' = Task table, or definition ID for record tables
    // Currently used for tracking only - could add visual focus ring later
    const [_focusedTableId, setFocusedTableId] = useState<string>('tasks');
    void _focusedTableId; // Acknowledge intentionally unused for now

    // Determine active subprocess: use local selection, or derive from selected node
    const activeSubprocessId = useMemo(() => {
        // If we have a local selection, use it
        if (localSubprocessId && subprocesses.find((sp) => sp.id === localSubprocessId)) {
            return localSubprocessId;
        }
        // Otherwise derive from selected node
        if (!selectedNode) return subprocesses[0]?.id || null;
        if (selectedNode.type === 'subprocess') return selectedNode.id;
        if (selectedNode.type === 'task') return selectedNode.parent_id;
        if (selectedNode.type === 'subtask') {
            // For subtasks, find the parent task's parent (subprocess)
            const parentTask = selectedNode.parent_id ? getNode(selectedNode.parent_id) : null;
            return parentTask?.parent_id || subprocesses[0]?.id || null;
        }
        return subprocesses[0]?.id || null;
    }, [localSubprocessId, selectedNode, subprocesses, getNode]);

    // Sync local selection when user clicks a subprocess in the sidebar
    const handleSubprocessClick = useCallback(
        (subprocessId: string) => {
            setLocalSubprocessId(subprocessId);
            setInspectorMode('record');
            inspectNode(subprocessId);
        },
        [setInspectorMode, inspectNode]
    );

    const activeSubprocess = activeSubprocessId ? getNode(activeSubprocessId) : null;

    const activeSubprocessMeta = useMemo(() => {
        if (!activeSubprocess) return null;
        return getNodeMetadata(activeSubprocess);
    }, [activeSubprocess]);

    const activeSubprocessLead =
        activeSubprocessMeta && typeof activeSubprocessMeta.lead === 'string' ? activeSubprocessMeta.lead : '';
    const activeSubprocessDueDate =
        activeSubprocessMeta && typeof activeSubprocessMeta.dueDate === 'string' ? activeSubprocessMeta.dueDate : '';

    const tasks = useMemo(() => {
        if (!activeSubprocessId) return [];
        return getChildren(activeSubprocessId).filter((n) => n.type === 'task');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSubprocessId, getChildren, storeNodes]);

    // ========== WORKFLOW SURFACE (Projection-Based System) ==========
    const [useWorkflowSurface, setUseWorkflowSurface] = useState(true);

    // Fetch workflow surface nodes for the active subprocess
    const { data: surfaceNodes = [] } = useWorkflowSurfaceNodes(useWorkflowSurface ? activeSubprocessId : null, 'subprocess');

    // Mutations for workflow surface interactions
    const startWork = useStartWork();
    const stopWork = useStopWork();
    const finishWork = useFinishWork();
    const blockWork = useBlockWork();
    const unblockWork = useUnblockWork();
    const recordFieldValue = useRecordFieldValue();

    // Handle field changes on surface nodes (emits FIELD_VALUE_RECORDED event)
    const handleSurfaceFieldChange = useCallback(
        (actionId: string, fieldKey: string, value: unknown) => {
            recordFieldValue.mutate({ actionId, fieldKey, value });
        },
        [recordFieldValue]
    );

    // Handle status changes on surface nodes (emits work events)
    const handleSurfaceStatusChange = useCallback(
        async (actionId: string, status: DerivedStatus) => {
            const current = surfaceNodes.find((n) => n.actionId === actionId);
            const prevStatus = (current?.payload.status as DerivedStatus | undefined) ?? 'pending';

            // Leaving blocked should emit an explicit unblock event (keeps event stream semantic)
            if (prevStatus === 'blocked' && status !== 'blocked') {
                await unblockWork.mutateAsync({ actionId });
            }

            if (status === 'active') {
                await startWork.mutateAsync({ actionId });
                return;
            }

            if (status === 'finished') {
                await finishWork.mutateAsync({ actionId });
                return;
            }

            if (status === 'pending') {
                await stopWork.mutateAsync({ actionId });
                return;
            }

            if (status === 'blocked') {
                const reason = window.prompt('Why is this blocked?') || undefined;
                await blockWork.mutateAsync({ actionId, reason });
            }
        },
        [surfaceNodes, unblockWork, startWork, finishWork, stopWork, blockWork]
    );

    // Handle row selection on surface nodes
    const handleSurfaceRowSelect = useCallback(
        (actionId: string) => {
            setFocusedTableId('tasks');
            setInspectorMode('record');

            // Bridge surface selection to inspector by locating a matching task node.
            // Matching strategies are metadata-driven so CSV imports can seed the linkage.
            const matchingTask = tasks.find((task) => {
                const taskMeta = getNodeMetadata(task);
                const metaActionId =
                    (typeof taskMeta.actionId === 'string' && taskMeta.actionId) ||
                    (typeof taskMeta.action_id === 'string' && taskMeta.action_id) ||
                    (typeof taskMeta.actionID === 'string' && taskMeta.actionID) ||
                    '';

                return metaActionId === actionId || task.id === actionId;
            });

            if (matchingTask) {
                inspectNode(matchingTask.id);
            }
        },
        [tasks, setInspectorMode, inspectNode]
    );

    // Fetch records classified under this subprocess (excluding tasks which are nodes)
    const { data: subprocessRecords = [] } = useRecords(activeSubprocessId ? { classificationNodeId: activeSubprocessId } : undefined);

    // Handle inline cell edits for DataRecords
    const handleRecordCellChange = useCallback(
        (recordId: string, fieldKey: string, value: unknown) => {
            const record = subprocessRecords.find((r) => r.id === recordId);
            if (!record) return;

            // Handle unique_name separately
            if (fieldKey === 'unique_name') {
                updateRecord.mutate({ id: recordId, uniqueName: String(value) });
                return;
            }

            // All other fields go into data object
            const updatedData = { ...record.data, [fieldKey]: value };
            updateRecord.mutate({ id: recordId, data: updatedData });
        },
        [subprocessRecords, updateRecord]
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

    if (!activeProjectId) {
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
        <div className="flex-1 flex overflow-hidden bg-white">
            {/* Left navigation (merged from old sidebar) */}
            <aside className="w-[320px] shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
                <div className="p-3 border-b border-slate-200 bg-white flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workflow</div>
                        {/* Show dropdown when multiple processes, otherwise just project title */}
                        {processes.length > 1 ? (
                            <div className="relative">
                                <button
                                    onClick={() => setIsProcessDropdownOpen(!isProcessDropdownOpen)}
                                    className="flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                                >
                                    <span className="truncate" title={selectedProcess?.title || project.title}>
                                        {selectedProcess?.title || project.title}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        className={`shrink-0 transition-transform ${isProcessDropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {isProcessDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsProcessDropdownOpen(false)} />
                                        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase">Processes</div>
                                            {processes.map((process) => (
                                                <button
                                                    key={process.id}
                                                    onClick={() => {
                                                        setSelectedProcessId(process.id);
                                                        setLocalSubprocessId(null); // Reset to show first subprocess of new process
                                                        setIsProcessDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                                                        process.id === selectedProcessId ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                                                    }`}
                                                >
                                                    <span className="truncate block" title={process.title}>
                                                        {process.title}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm font-semibold text-slate-800 truncate" title={project.title}>
                                {project.title}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => openDrawer('create-node', { parentId: project.id, nodeType: 'process' })}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Add Process"
                    >
                        <Plus size={16} />
                    </button>
                </div>

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
                                        onClick={() => handleSubprocessClick(sp.id)}
                                        className={
                                            isActive
                                                ? 'w-full text-left px-3 py-2 rounded bg-blue-50 text-blue-700 border border-blue-100'
                                                : 'w-full text-left px-3 py-2 rounded hover:bg-white text-slate-700 border border-transparent'
                                        }
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
            </aside>

            {/* Task table (merged from old project list view) */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-400">Subprocess</div>
                        {/* Subprocess dropdown when multiple exist */}
                        {subprocesses.length > 1 ? (
                            <div className="relative">
                                <button
                                    onClick={() => setIsSubprocessDropdownOpen(!isSubprocessDropdownOpen)}
                                    className="flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                                >
                                    <span className="truncate" title={activeSubprocess?.title}>
                                        {activeSubprocess?.title || 'Select a subprocess'}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        className={`shrink-0 transition-transform ${isSubprocessDropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {isSubprocessDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsSubprocessDropdownOpen(false)} />
                                        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                                            {subprocesses.map((sp) => (
                                                <button
                                                    key={sp.id}
                                                    onClick={() => {
                                                        handleSubprocessClick(sp.id);
                                                        setIsSubprocessDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                                                        sp.id === activeSubprocessId ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                                                    }`}
                                                >
                                                    <span className="truncate block" title={sp.title}>
                                                        {sp.title}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm font-semibold text-slate-800 truncate">
                                {activeSubprocess?.title || 'Select a subprocess'}
                            </div>
                        )}
                    </div>
                    {/* Add dropdown menu + Composer button */}
                    {activeSubprocessId && (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                >
                                    <Plus size={14} />
                                    <span>Add</span>
                                    <ChevronDown size={12} className={`transition-transform ${isAddDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isAddDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsAddDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                                            <button
                                                onClick={() => {
                                                    openDrawer('create-node', { parentId: activeSubprocessId, nodeType: 'task' });
                                                    setIsAddDropdownOpen(false);
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                            >
                                                <span className="w-5 h-5 rounded bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">T</span>
                                                Add Task
                                            </button>
                                            {/* Add Subtask - only enabled when a task is selected */}
                                            <button
                                                onClick={() => {
                                                    if (selectedNode?.type === 'task') {
                                                        openDrawer('create-node', { parentId: selectedNode.id, nodeType: 'subtask' });
                                                    } else if (selectedNode?.type === 'subtask' && selectedNode.parent_id) {
                                                        // If subtask selected, add sibling under same parent task
                                                        openDrawer('create-node', { parentId: selectedNode.parent_id, nodeType: 'subtask' });
                                                    }
                                                    setIsAddDropdownOpen(false);
                                                }}
                                                disabled={!selectedNode || (selectedNode.type !== 'task' && selectedNode.type !== 'subtask')}
                                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                    selectedNode && (selectedNode.type === 'task' || selectedNode.type === 'subtask')
                                                        ? 'text-slate-700 hover:bg-slate-50'
                                                        : 'text-slate-400 cursor-not-allowed'
                                                }`}
                                            >
                                                <span
                                                    className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                                        selectedNode && (selectedNode.type === 'task' || selectedNode.type === 'subtask')
                                                            ? 'bg-teal-100 text-teal-600'
                                                            : 'bg-slate-100 text-slate-400'
                                                    }`}
                                                >
                                                    ST
                                                </span>
                                                Add Subtask
                                            </button>
                                            {/* Divider */}
                                            {definitions && definitions.filter((d) => !d.is_system && d.name !== 'Task').length > 0 && (
                                                <div className="border-t border-slate-100 my-1" />
                                            )}
                                            {/* Record types from definitions */}
                                            {definitions &&
                                                definitions
                                                    .filter((d) => !d.is_system && d.name !== 'Task')
                                                    .map((def) => (
                                                        <button
                                                            key={def.id}
                                                            onClick={() => {
                                                                openDrawer('create-record', {
                                                                    definitionId: def.id,
                                                                    classificationNodeId: activeSubprocessId,
                                                                });
                                                                setIsAddDropdownOpen(false);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                        >
                                                            <span className="w-5 h-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center text-xs">
                                                                {def.styling?.icon || def.name.charAt(0)}
                                                            </span>
                                                            Add {def.name}
                                                        </button>
                                                    ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Composer Button */}
                            <button
                                onClick={() => setIsComposerOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 rounded shadow-sm transition-all"
                            >
                                <Wand2 size={14} />
                                <span>Composer</span>
                            </button>
                        </div>
                    )}

                    {/* Composer Dialog */}
                    {isComposerOpen && activeSubprocessId && (
                        <>
                            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setIsComposerOpen(false)} />
                            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-2xl overflow-hidden">
                                <ComposerSurface
                                    mode="drawer"
                                    contextId={activeSubprocessId}
                                    onSuccess={() => setIsComposerOpen(false)}
                                    onClose={() => setIsComposerOpen(false)}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="flex-1 overflow-auto custom-scroll p-4">
                    <div className="min-w-[900px] space-y-4">
                        {/* Task Table - Toggle between hierarchy-based and surface-based */}
                        <div onFocus={() => setFocusedTableId('tasks')} onClick={() => setFocusedTableId('tasks')}>
                            {/* Toggle switch for development/testing */}
                            <div className="flex items-center justify-end gap-2 mb-2 text-xs">
                                <span className="text-slate-400">View Mode:</span>
                                <button
                                    onClick={() => setUseWorkflowSurface(false)}
                                    className={`px-2 py-1 rounded ${
                                        !useWorkflowSurface ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                >
                                    Hierarchy
                                </button>
                                <button
                                    onClick={() => setUseWorkflowSurface(true)}
                                    className={`px-2 py-1 rounded ${
                                        useWorkflowSurface ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                >
                                    Surface
                                </button>
                            </div>

                            {useWorkflowSurface ? (
                                <WorkflowSurfaceTable
                                    nodes={surfaceNodes}
                                    selectedActionId={null} // TODO: Track selected action
                                    onRowSelect={handleSurfaceRowSelect}
                                    onFieldChange={handleSurfaceFieldChange}
                                    onStatusChange={handleSurfaceStatusChange}
                                    onAddAction={activeSubprocessId ? () => setIsComposerOpen(true) : undefined}
                                    emptyMessage="No actions yet. Use Composer to declare one."
                                />
                            ) : (
                                <DataTableHierarchy
                                    nodes={tasks}
                                    fields={taskFields}
                                    fallbacks={{
                                        assignee: activeSubprocessLead,
                                        owner: activeSubprocessLead,
                                        dueDate: activeSubprocessDueDate,
                                    }}
                                    selectedNodeId={selectedNodeId}
                                    onRowSelect={(nodeId) => {
                                        setFocusedTableId('tasks');
                                        setInspectorMode('record');
                                        inspectNode(nodeId);
                                    }}
                                    onCellChange={handleCellChange}
                                    onAddNode={
                                        activeSubprocessId
                                            ? () => openDrawer('create-node', { parentId: activeSubprocessId, nodeType: 'task' })
                                            : undefined
                                    }
                                    enableNesting
                                    getChildren={(nodeId) => getChildren(nodeId).filter((n) => n.type === 'subtask')}
                                    onAddSubtask={(parentId) => openDrawer('create-node', { parentId, nodeType: 'subtask' })}
                                    deriveStatus={deriveNodeStatus}
                                    showStatusSummary
                                    statusConfig={statusConfig}
                                    emptyMessage="No tasks yet. Click + to add one."
                                />
                            )}
                        </div>

                        {/* Floating Record Tables - Independent tables for each record definition */}
                        {recordsByDefinition.map(({ definition, records }) => (
                            <div key={definition.id} onFocus={() => setFocusedTableId(definition.id)} onClick={() => setFocusedTableId(definition.id)}>
                                <DataTableFlat
                                    definition={definition}
                                    records={records}
                                    selectedRecordId={selectedRecordId}
                                    onRowSelect={(id) => {
                                        setFocusedTableId(definition.id);
                                        useUIStore.getState().inspectRecord(id);
                                        setInspectorMode('record');
                                    }}
                                    onCellChange={handleRecordCellChange}
                                    onAddRecord={
                                        activeSubprocessId
                                            ? () =>
                                                openDrawer('create-record', {
                                                    definitionId: definition.id,
                                                    classificationNodeId: activeSubprocessId,
                                                })
                                            : undefined
                                    }
                                    compact
                                    emptyMessage={`No ${definition.name} records yet.`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
