import { useEffect, useMemo } from 'react';
import { useProjectTree, useRecordDefinitions, useRecords } from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import type { HierarchyNode, DataRecord, RecordDefinition } from '../../types';
import { TaskDataTable } from '../tables/TaskDataTable';
import { RecordDataTable } from '../tables/RecordDataTable';
import {
    DEFAULT_TASK_FIELDS,
    type TaskFieldDef,
} from '../../utils/nodeMetadata';

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
    // Sort subprocesses via the full hierarchy: process -> stage -> subprocess.
    // Previously this only considered the first process, which breaks ordering
    // once a project has multiple processes.
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

export function ProjectWorkflowView() {
    // Subscribe to nodes directly to ensure reactivity when nodes are updated
    const storeNodes = useHierarchyStore((state) => state.nodes);
    const setNodes = useHierarchyStore((state) => state.setNodes);
    const getNode = useHierarchyStore((state) => state.getNode);
    const getChildren = useHierarchyStore((state) => state.getChildren);
    const { activeProjectId, selection, inspectNode, setInspectorMode, openDrawer } = useUIStore();

    // Fetch record definitions to get Task schema
    const { data: definitions } = useRecordDefinitions();

    // Get Task definition fields - merge defaults with custom fields from definition
    const taskFields = useMemo(() => {
        const taskDef = definitions?.find((d) => d.name === 'Task');

        // Start with all default fields
        const mergedFields = DEFAULT_TASK_FIELDS.map((defaultField) => {
            // Check if this default field is overridden in the definition
            const definitionField = taskDef?.schema_config?.fields?.find((f) => f.key === defaultField.key);
            if (definitionField) {
                // Merge definition field with default display properties
                return {
                    key: definitionField.key,
                    label: definitionField.label,
                    type: definitionField.type,
                    options: definitionField.options,
                    renderAs: (definitionField as { renderAs?: string }).renderAs || defaultField.renderAs || 'text',
                    showInCollapsed: defaultField.showInCollapsed,
                    showInExpanded: defaultField.showInExpanded,
                    width: defaultField.width,
                } as TaskFieldDef;
            }
            return defaultField;
        });

        // Add custom fields from definition that aren't in defaults
        if (taskDef?.schema_config?.fields) {
            const defaultKeys = DEFAULT_TASK_FIELDS.map((f) => f.key);
            const customFields = taskDef.schema_config.fields
                .filter((f) => !defaultKeys.includes(f.key))
                .map((field) => ({
                    key: field.key,
                    label: field.label,
                    type: field.type,
                    options: field.options,
                    renderAs: (field as { renderAs?: string }).renderAs || 'text',
                    showInCollapsed: false, // Custom fields default to expanded only
                    showInExpanded: true,
                    width: 'flex' as const,
                } as TaskFieldDef));

            mergedFields.push(...customFields);
        }

        return mergedFields;
    }, [definitions]);

    // Ensure we still load the hierarchy even when the outer sidebar is hidden.
    const { data: queryNodes } = useProjectTree(activeProjectId);
    useEffect(() => {
        if (queryNodes) setNodes(queryNodes);
    }, [queryNodes, setNodes]);

    const project = activeProjectId ? getNode(activeProjectId) : null;

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

    const activeSubprocessLead =
        activeSubprocessMeta && typeof activeSubprocessMeta.lead === 'string' ? activeSubprocessMeta.lead : '';
    const activeSubprocessDueDate =
        activeSubprocessMeta && typeof activeSubprocessMeta.dueDate === 'string' ? activeSubprocessMeta.dueDate : '';

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
                <div className="p-3 border-b border-slate-200 bg-white">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workflow</div>
                    <div className="text-sm font-semibold text-slate-800 truncate" title={project.title}>
                        {project.title}
                    </div>
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
                                        onClick={() => {
                                            setInspectorMode('record');
                                            inspectNode(sp.id);
                                        }}
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
                    <div className="min-w-0">
                        <div className="text-xs text-slate-400">Subprocess</div>
                        <div className="text-sm font-semibold text-slate-800 truncate">
                            {activeSubprocess?.title || 'Select a subprocess'}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scroll p-4">
                    <div className="min-w-[900px] space-y-4">
                        {/* Task Table - using modular TaskDataTable */}
                        <TaskDataTable
                            tasks={tasks}
                            fields={taskFields}
                            fallbacks={{
                                owner: activeSubprocessLead,
                                dueDate: activeSubprocessDueDate,
                            }}
                            selectedTaskId={selectedNodeId}
                            onSelectTask={(taskId) => {
                                setInspectorMode('record');
                                inspectNode(taskId);
                            }}
                            onAddTask={
                                activeSubprocessId
                                    ? () => openDrawer('create-node', { parentId: activeSubprocessId, nodeType: 'task' })
                                    : undefined
                            }
                            showStatusSummary
                        />

                        {/* Floating Record Tables - Independent tables for each record definition */}
                        {recordsByDefinition.map(({ definition, records }) => (
                            <RecordDataTable
                                key={definition.id}
                                definition={definition}
                                records={records}
                                selectedRecordId={selectedRecordId}
                                onSelectRecord={(id) => {
                                    useUIStore.getState().inspectRecord(id);
                                    setInspectorMode('record');
                                }}
                                onAddRecord={() => {
                                    openDrawer('create-record', {
                                        definitionId: definition.id,
                                        classificationNodeId: activeSubprocessId,
                                    });
                                }}
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
