import { Plus, ChevronDown, Wand2, PanelLeftClose, PanelLeftOpen, Layers, FolderOpen, Check, Copy, FileText, FileMinus, Database } from 'lucide-react';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { ProjectSidebarPanel } from '../panels/ProjectSidebarPanel';
import { ResizeHandle } from '../common/ResizeHandle';
import type { DerivedStatus } from '@autoart/shared';

import {
    useProjectTree,
    useProjects,
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
import { ActionRegistryTable } from '../../ui/composites/ActionRegistryTable';
import { deriveTaskStatus, TASK_STATUS_CONFIG } from '../../utils/nodeMetadata';
import { ComposerSurface } from '../composer';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator, DropdownLabel, Menu, Badge, Text } from '@autoart/ui';

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
    const { activeProjectId, selection, inspectNode, setInspectorMode, openDrawer, setActiveProject } = useUIStore();

    // Fetch all projects for the project selector
    const { data: allProjects } = useProjects();

    // Sidebar state
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const handleSidebarResize = useCallback((delta: number) => {
        setSidebarWidth((prev) => Math.max(200, Math.min(600, prev + delta)));
    }, []);





    // Let's scroll down to where other useState calls are (around line 216 or 303).
    // line 303: const [useWorkflowSurface, setUseWorkflowSurface] = useState(true);
    // I will add my state there.

    // Then I will replace the return block.

    // Actually, let's do the return block replacement first, as it contains the main visual changes.
    // And for the state, I can insert it after `useWorkflowSurface`.




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

    // Auto-select first process when processes change
    useEffect(() => {
        if (processes.length > 0 && (!selectedProcessId || !processes.find((p) => p.id === selectedProcessId))) {
            setSelectedProcessId(processes[0].id);
        }
    }, [processes, selectedProcessId]);



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

    return (
        <div className="flex-1 flex overflow-hidden bg-white relative" style={{ position: 'relative' }}>
            {/* Collapsed Sidebar Toggle (Floating when collapsed) */}
            {isSidebarCollapsed && (
                <div className="absolute top-3 left-3 z-20">
                    <button
                        onClick={() => setIsSidebarCollapsed(false)}
                        className="p-1.5 bg-white border border-slate-200 rounded-md shadow-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                        title="Expand Sidebar"
                    >
                        <PanelLeftOpen size={16} />
                    </button>
                </div>
            )}

            {/* Left navigation (merged from old sidebar) - Now reusing shared ProjectSidebarPanel */}
            <aside
                className={`shrink-0 border-r border-slate-200 bg-slate-50 overflow-hidden flex flex-col relative transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-0 opacity-0 border-r-0' : 'opacity-100'
                    }`}
                style={{ width: isSidebarCollapsed ? 0 : sidebarWidth }}
            >
                <div className="flex-1 overflow-hidden relative">
                    <ProjectSidebarPanel />

                    {/* Collapse Button inside sidebar */}
                    <button
                        onClick={() => setIsSidebarCollapsed(true)}
                        className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors z-10"
                        title="Collapse Sidebar"
                    >
                        <PanelLeftClose size={14} />
                    </button>
                </div>

                {/* Resize Handle */}
                {!isSidebarCollapsed && (
                    <div className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize z-20 hover:bg-blue-300 transition-colors">
                        <ResizeHandle
                            direction="right"
                            onResize={handleSidebarResize}
                            className="w-full h-full opacity-0 hover:opacity-100"
                        />
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {!activeProjectId ? (
                    <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
                        <div className="text-center">
                            <p className="text-lg font-medium">No project selected</p>
                            <p className="text-sm">Select a project from the top menu</p>
                        </div>
                    </div>
                ) : !project ? (
                    <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
                        <div className="text-center">
                            <p className="text-lg font-medium">Loading project…</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between">
                            <div className="min-w-0 flex-1 flex items-center gap-4">
                                {/* Project Selector */}
                                <div className="min-w-0">
                                    <div className="text-xs text-slate-400">Project</div>
                                    <Menu>
                                        <Menu.Target>
                                            <button className="flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors focus:outline-none">
                                                {project ? (
                                                    <span className="truncate" title={project.title}>
                                                        {project.title}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">Select a project...</span>
                                                )}
                                                <ChevronDown size={14} className="shrink-0 text-slate-400" />
                                            </button>
                                        </Menu.Target>
                                        <Menu.Dropdown className="min-w-[240px]">
                                            <Menu.Item leftSection={<Plus size={16} />} onClick={() => openDrawer('create-project', {})}>
                                                New Project
                                            </Menu.Item>
                                            {project && (
                                                <Menu.Item leftSection={<Copy size={16} />} onClick={() => openDrawer('clone-project', { sourceProjectId: project.id, sourceProjectTitle: project.title })}>
                                                    Clone Current
                                                </Menu.Item>
                                            )}
                                            <Menu.Divider />
                                            <Menu.Label>Your Projects</Menu.Label>
                                            {allProjects && allProjects.length > 0 ? (
                                                allProjects.map((p) => (
                                                    <Menu.Item
                                                        key={p.id}
                                                        leftSection={<FolderOpen size={16} />}
                                                        rightSection={p.id === activeProjectId ? <Check size={16} className="text-blue-600" /> : null}
                                                        onClick={() => setActiveProject(p.id)}
                                                        className={p.id === activeProjectId ? 'bg-blue-50' : ''}
                                                    >
                                                        <Text size="sm" truncate className="max-w-[180px]">{p.title}</Text>
                                                    </Menu.Item>
                                                ))
                                            ) : (
                                                <Text size="sm" color="muted" className="text-center py-3">
                                                    No projects yet
                                                </Text>
                                            )}
                                        </Menu.Dropdown>
                                    </Menu>
                                </div>

                                {/* Subprocess Selector */}
                                <div className="min-w-0">
                                    <div className="text-xs text-slate-400">Subprocess</div>
                                    {/* Subprocess dropdown when multiple exist */}
                                    {subprocesses.length > 1 ? (
                                        <div className="relative">
                                            <Dropdown>
                                                <DropdownTrigger className="flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors focus:outline-none">
                                                    <span className="truncate" title={activeSubprocess?.title}>
                                                        {activeSubprocess?.title || 'Select a subprocess'}
                                                    </span>
                                                    <ChevronDown size={14} className="shrink-0 text-slate-400" />
                                                </DropdownTrigger>
                                                <DropdownContent align="start" className="w-56 max-h-64 overflow-y-auto">
                                                    {subprocesses.map((sp) => (
                                                        <DropdownItem
                                                            key={sp.id}
                                                            onSelect={() => handleSubprocessClick(sp.id)}
                                                            className={sp.id === activeSubprocessId ? 'bg-blue-50 text-blue-700' : ''}
                                                        >
                                                            <span className="truncate">{sp.title}</span>
                                                        </DropdownItem>
                                                    ))}
                                                </DropdownContent>
                                            </Dropdown>
                                        </div>
                                    ) : (
                                        <div className="text-sm font-semibold text-slate-800 truncate">
                                            {activeSubprocess?.title || 'Select a subprocess'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Add dropdown menu + Composer button */}
                            {activeSubprocessId && (
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Dropdown>
                                            <DropdownTrigger className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors focus:outline-none">
                                                <Plus size={14} />
                                                <span>Add</span>
                                                <ChevronDown size={12} className="text-slate-400" />
                                            </DropdownTrigger>
                                            <DropdownContent align="end" className="w-44">
                                                <DropdownItem
                                                    onSelect={() => openDrawer('create-node', { parentId: activeSubprocessId, nodeType: 'task' })}
                                                >
                                                    <span className="w-5 h-5 rounded bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold mr-2">T</span>
                                                    Add Task
                                                </DropdownItem>

                                                <DropdownItem
                                                    onSelect={() => {
                                                        if (selectedNode?.type === 'task') {
                                                            openDrawer('create-node', { parentId: selectedNode.id, nodeType: 'subtask' });
                                                        } else if (selectedNode?.type === 'subtask' && selectedNode.parent_id) {
                                                            openDrawer('create-node', { parentId: selectedNode.parent_id, nodeType: 'subtask' });
                                                        }
                                                    }}
                                                    disabled={!selectedNode || (selectedNode.type !== 'task' && selectedNode.type !== 'subtask')}
                                                >
                                                    <span
                                                        className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold mr-2 ${selectedNode && (selectedNode.type === 'task' || selectedNode.type === 'subtask')
                                                            ? 'bg-teal-100 text-teal-600'
                                                            : 'bg-slate-100 text-slate-400'
                                                            }`}
                                                    >
                                                        ST
                                                    </span>
                                                    Add Subtask
                                                </DropdownItem>

                                                {definitions && definitions.filter((d) => !d.is_system && d.name !== 'Task').length > 0 && (
                                                    <DropdownSeparator />
                                                )}

                                                {definitions &&
                                                    definitions
                                                        .filter((d) => !d.is_system && d.name !== 'Task')
                                                        .map((def) => (
                                                            <DropdownItem
                                                                key={def.id}
                                                                onSelect={() =>
                                                                    openDrawer('create-record', {
                                                                        definitionId: def.id,
                                                                        classificationNodeId: activeSubprocessId,
                                                                    })
                                                                }
                                                            >
                                                                <span className="w-5 h-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center text-xs mr-2">
                                                                    {def.styling?.icon || def.name.charAt(0)}
                                                                </span>
                                                                Add {def.name}
                                                            </DropdownItem>
                                                        ))}
                                            </DropdownContent>
                                        </Dropdown>
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

                        <div className="flex-1 overflow-hidden flex flex-col">
                            {/* View Mode Toggle Bar */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50/50 shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                                        <button
                                            onClick={() => setUseWorkflowSurface(false)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${!useWorkflowSurface
                                                ? 'bg-white shadow-sm text-slate-700'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            <Layers size={14} />
                                            Hierarchy
                                        </button>
                                        <button
                                            onClick={() => setUseWorkflowSurface(true)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${useWorkflowSurface
                                                ? 'bg-white shadow-sm text-slate-700'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            <Layers size={14} />
                                            Registry
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Main Table Area */}
                            <div className="flex-1 overflow-auto p-4" onFocus={() => setFocusedTableId('tasks')} onClick={() => setFocusedTableId('tasks')}>
                                <div className="h-full min-h-[400px]">
                                    {useWorkflowSurface ? (
                                        <ActionRegistryTable
                                            nodes={surfaceNodes}
                                            selectedActionId={selectedNodeId}
                                            onRowSelect={handleSurfaceRowSelect}
                                            onFieldChange={handleSurfaceFieldChange}
                                            onStatusChange={handleSurfaceStatusChange}
                                            onAddAction={activeSubprocessId ? () => setIsComposerOpen(true) : undefined}
                                            onRowAction={(actionId, action) => {
                                                if (action === 'view') handleSurfaceRowSelect(actionId);
                                            }}
                                            contextLabel={activeSubprocess?.title}
                                            emptyMessage="No actions yet. Use Composer to declare one."
                                            className="h-full"
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
                                            emptyState={
                                                activeSubprocessId ? (
                                                    <div className="flex flex-col items-center justify-center py-12">
                                                        <Dropdown>
                                                            <DropdownTrigger className="w-12 h-12 bg-white border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 rounded-full flex items-center justify-center transition-all mb-3">
                                                                <Plus size={24} />
                                                            </DropdownTrigger>
                                                            <DropdownContent className="w-56">
                                                                <DropdownLabel>Tasks</DropdownLabel>
                                                                <DropdownItem
                                                                    onSelect={() =>
                                                                        openDrawer('create-node', {
                                                                            parentId: activeSubprocessId,
                                                                            nodeType: 'task',
                                                                        })
                                                                    }
                                                                >
                                                                    <FileText size={14} className="mr-2" />
                                                                    Add Task
                                                                </DropdownItem>
                                                                <DropdownItem
                                                                    onSelect={() => {
                                                                        if (selectedNode?.type === 'task') {
                                                                            openDrawer('create-node', { parentId: selectedNode.id, nodeType: 'subtask' });
                                                                        } else if (selectedNode?.type === 'subtask' && selectedNode.parent_id) {
                                                                            openDrawer('create-node', { parentId: selectedNode.parent_id, nodeType: 'subtask' });
                                                                        }
                                                                    }}
                                                                    disabled={!selectedNode || (selectedNode.type !== 'task' && selectedNode.type !== 'subtask')}
                                                                >
                                                                    <FileMinus size={14} className="mr-2" />
                                                                    Add Subtask
                                                                </DropdownItem>

                                                                {definitions && definitions.filter((d) => !d.is_system && d.name !== 'Task').length > 0 && (
                                                                    <>
                                                                        <DropdownSeparator />
                                                                        <DropdownLabel>Records</DropdownLabel>
                                                                        {definitions
                                                                            .filter((d) => !d.is_system && d.name !== 'Task')
                                                                            .map((def) => (
                                                                                <DropdownItem
                                                                                    key={def.id}
                                                                                    onSelect={() =>
                                                                                        openDrawer('create-record', {
                                                                                            definitionId: def.id,
                                                                                            classificationNodeId: activeSubprocessId,
                                                                                        })
                                                                                    }
                                                                                >
                                                                                    <Database size={14} className="mr-2" />
                                                                                    Add {def.name}
                                                                                </DropdownItem>
                                                                            ))}
                                                                    </>
                                                                )}
                                                            </DropdownContent>
                                                        </Dropdown>
                                                        <p className="text-sm text-slate-500">Add your first task</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-slate-500">Select a subprocess to view tasks</span>
                                                )
                                            }
                                        />
                                    )}
                                </div>

                                {/* Floating Record Tables - Independent tables for each record definition */}
                                {recordsByDefinition.length > 0 && (
                                    <div className="mt-6 space-y-4">
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
                                )}

                                {/* Circular Add Button */}
                                {activeSubprocessId && (
                                    <div className="flex justify-center pt-6 pb-4">
                                        <Dropdown>
                                            <DropdownTrigger className="w-10 h-10 bg-white border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 rounded-full flex items-center justify-center transition-all">
                                                <Plus size={20} />
                                            </DropdownTrigger>
                                            <DropdownContent className="w-56">
                                                <DropdownLabel>Tasks</DropdownLabel>
                                                <DropdownItem
                                                    onSelect={() =>
                                                        openDrawer('create-node', {
                                                            parentId: activeSubprocessId,
                                                            nodeType: 'task',
                                                        })
                                                    }
                                                >
                                                    <FileText size={14} className="mr-2" />
                                                    Add Task
                                                </DropdownItem>
                                                <DropdownItem
                                                    onSelect={() => {
                                                        if (selectedNode?.type === 'task') {
                                                            openDrawer('create-node', { parentId: selectedNode.id, nodeType: 'subtask' });
                                                        } else if (selectedNode?.type === 'subtask' && selectedNode.parent_id) {
                                                            openDrawer('create-node', { parentId: selectedNode.parent_id, nodeType: 'subtask' });
                                                        }
                                                    }}
                                                    disabled={!selectedNode || (selectedNode.type !== 'task' && selectedNode.type !== 'subtask')}
                                                >
                                                    <FileMinus size={14} className="mr-2" />
                                                    Add Subtask
                                                </DropdownItem>

                                                {definitions && definitions.filter((d) => !d.is_system && d.name !== 'Task').length > 0 && (
                                                    <>
                                                        <DropdownSeparator />
                                                        <DropdownLabel>Records</DropdownLabel>
                                                        {definitions
                                                            .filter((d) => !d.is_system && d.name !== 'Task')
                                                            .map((def) => (
                                                                <DropdownItem
                                                                    key={def.id}
                                                                    onSelect={() =>
                                                                        openDrawer('create-record', {
                                                                            definitionId: def.id,
                                                                            classificationNodeId: activeSubprocessId,
                                                                        })
                                                                    }
                                                                >
                                                                    <Database size={14} className="mr-2" />
                                                                    Add {def.name}
                                                                </DropdownItem>
                                                            ))}
                                                    </>
                                                )}
                                            </DropdownContent>
                                        </Dropdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
