import { Settings, Plus, ChevronDown, FolderOpen, Check, Copy, Library, Hammer } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
// import { IDockviewPanelProps } from 'dockview';

import { TreeNode } from '../hierarchy/TreeNode';
import { useProjectTree, useProjects } from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import type { NodeType } from '../../types';
import { Badge } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { Menu } from '@autoart/ui';

export function ProjectSidebar() {
    const { setNodes, getChildren, getNode } = useHierarchyStore();
    const { activeProjectId, selection, setSelection, openOverlay, setActiveProject } = useUIStore();
    const { data: nodes } = useProjectTree(activeProjectId);
    const { data: projects } = useProjects();

    const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
    const [isProcessDropdownOpen, setIsProcessDropdownOpen] = useState(false);

    // Update store when nodes load
    useEffect(() => {
        if (nodes) {
            setNodes(nodes);
        }
    }, [nodes, setNodes]);

    const project = activeProjectId ? getNode(activeProjectId) : null;
    const processes = useMemo(() => project ? getChildren(project.id) : [], [project, getChildren]);

    // Derive default process ID (first process or null)
    const defaultProcessId = useMemo(() => processes[0]?.id ?? null, [processes]);

    // Validate and use selected process or fall back to default
    const effectiveProcessId = useMemo(() => {
        if (selectedProcessId && processes.find(p => p.id === selectedProcessId)) {
            return selectedProcessId;
        }
        return defaultProcessId;
    }, [selectedProcessId, processes, defaultProcessId]);

    // Use effective ID for all derived values (no sync effect needed)
    const selectedProcess = effectiveProcessId ? getNode(effectiveProcessId) : null;
    const stages = selectedProcess ? getChildren(selectedProcess.id) : [];

    // Determine what type of node to create based on current selection
    const selectedNodeId = selection?.type === 'node' ? selection.id : null;
    const selectedNode = selectedNodeId ? getNode(selectedNodeId) : null;

    const getCreateNodeConfig = (): { parentId: string; nodeType: Exclude<NodeType, 'project' | 'process'> } | null => {
        if (!selectedProcess) return null;

        if (!selectedNode || selectedNode.type === 'process') {
            // No selection or process selected → create stage under process
            return { parentId: selectedProcess.id, nodeType: 'stage' };
        }
        if (selectedNode.type === 'stage') {
            // Stage selected → create subprocess under stage
            return { parentId: selectedNode.id, nodeType: 'subprocess' };
        }
        if (selectedNode.type === 'subprocess') {
            // Subprocess selected → create stage under process (sibling to parent's parent)
            return { parentId: selectedProcess.id, nodeType: 'stage' };
        }
        // Default: create stage
        return { parentId: selectedProcess.id, nodeType: 'stage' };
    };

    const createConfig = getCreateNodeConfig();

    return (
        <div className="flex flex-col h-full bg-ws-bg overflow-hidden relative" style={{ position: 'relative' }}>
            {/* Project Selector */}
            <div className="p-3 border-b border-ws-panel-border bg-ws-panel-bg">
                <p className="text-[10px] font-semibold text-ws-muted uppercase tracking-wider mb-1">
                    Project
                </p>
                <Menu>
                    <Menu.Target>
                        <button className="w-full flex items-center justify-between bg-ws-bg hover:bg-slate-100 border border-ws-panel-border px-3 py-2 rounded-lg transition-colors text-left">
                            {project ? (
                                <div className="flex items-center gap-2 min-w-0">
                                    <Badge variant="project" size="xs">Project</Badge>
                                    <Text size="sm" weight="semibold" truncate className="max-w-[140px]">
                                        {project.title}
                                    </Text>
                                </div>
                            ) : (
                                <Text size="sm" color="muted">Select a project...</Text>
                            )}
                            <ChevronDown size={14} className="text-ws-muted shrink-0" />
                        </button>
                    </Menu.Target>
                    <Menu.Dropdown className="min-w-[240px]">
                        <Menu.Item leftSection={<Plus size={16} />} onClick={() => openOverlay('create-project', {})}>
                            New Project
                        </Menu.Item>
                        {project && (
                            <>
                                <Menu.Item leftSection={<Copy size={16} />} onClick={() => openOverlay('clone-project', { sourceProjectId: project.id, sourceProjectTitle: project.title })}>
                                    Clone Current
                                </Menu.Item>
                                <Menu.Item leftSection={<Library size={16} />} onClick={() => openOverlay('project-library', { projectId: project.id, projectTitle: project.title })}>
                                    Template Library
                                </Menu.Item>
                                <Menu.Item component={Link} to="/import" leftSection={<Hammer size={16} />}>
                                    Import Data
                                </Menu.Item>
                            </>
                        )}
                        <Menu.Divider />
                        <Menu.Label>Your Projects</Menu.Label>
                        {projects && projects.length > 0 ? (
                            projects.map((p) => (
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
            {processes.length > 0 && (
                <div className="p-3 border-b border-ws-panel-border bg-ws-panel-bg">
                    <p className="text-[10px] font-semibold text-ws-muted uppercase tracking-wider mb-1">
                        Process {processes.length > 1 && `(${processes.length})`}
                    </p>
                    <div className="relative">
                        <button
                            onClick={() => processes.length > 1 ? setIsProcessDropdownOpen(!isProcessDropdownOpen) : setSelection({ type: 'node', id: selectedProcess!.id })}
                            className="w-full flex items-center justify-between bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-900 px-3 py-2 rounded-lg transition-colors text-left group"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Settings size={16} className="shrink-0" />
                                <span className="text-sm font-semibold truncate">{selectedProcess?.title || 'Select process'}</span>
                            </div>
                            {processes.length > 1 ? (
                                <ChevronDown size={16} className={`text-purple-400 transition-transform ${isProcessDropdownOpen ? 'rotate-180' : ''}`} />
                            ) : (
                                <span className="text-purple-400 text-xs group-hover:text-purple-600">Edit</span>
                            )}
                        </button>

                        {/* Process Dropdown */}
                        {isProcessDropdownOpen && processes.length > 1 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-ws-panel-bg border border-ws-panel-border rounded-lg shadow-lg z-50 overflow-hidden">
                                {processes.map((process) => (
                                    <button
                                        key={process.id}
                                        onClick={() => {
                                            setSelectedProcessId(process.id);
                                            setIsProcessDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-ws-bg transition-colors ${process.id === selectedProcessId ? 'bg-purple-50 text-purple-700' : 'text-ws-text-secondary'
                                            }`}
                                    >
                                        <Settings size={14} className="shrink-0" />
                                        <span className="truncate">{process.title}</span>
                                    </button>
                                ))}
                                <div className="border-t border-ws-panel-border">
                                    <button
                                        onClick={() => {
                                            setIsProcessDropdownOpen(false);
                                            if (selectedProcess) setSelection({ type: 'node', id: selectedProcess.id });
                                        }}
                                        className="w-full px-3 py-2 text-xs text-purple-600 hover:bg-purple-50 text-left"
                                    >
                                        Edit current process
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tree View */}
            <div className="flex-1 overflow-y-auto p-2 custom-scroll">
                {stages.map((stage) => (
                    <TreeNode key={stage.id} node={stage} level={0} />
                ))}

                {/* Create New Button */}
                <div className="pt-4 px-2">
                    <button
                        onClick={() => createConfig && openOverlay('create-node', createConfig)}
                        disabled={!createConfig}
                        className="w-full py-2 border border-dashed border-slate-300 rounded text-xs text-ws-text-secondary hover:border-slate-400 hover:text-ws-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                    >
                        <Plus size={14} />
                        New {createConfig?.nodeType === 'subprocess' ? 'Subprocess' : 'Stage'}
                    </button>
                </div>
            </div>
        </div>
    );
}
