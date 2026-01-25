/**
 * ProjectPanel - Workspace-bound project panel
 *
 * A project panel that can be bound to the workspace's active project.
 * When bound, it automatically follows the workspace's boundProjectId.
 * When unbound (user manually selects a different project), it uses its own override.
 */

import { ChevronDown, Check, Unlink } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview';

import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useProjects } from '../../api/hooks';
import { ProjectView } from '../composites/ProjectView';
import { Menu } from '@autoart/ui';
import { BUILT_IN_WORKSPACES } from '../../workspace/workspacePresets';

interface ProjectPanelProps {
    panelId: string;
}

export function ProjectPanelContent({ panelId }: ProjectPanelProps) {
    const boundProjectId = useWorkspaceStore((s) => s.boundProjectId);
    const boundPanelIds = useWorkspaceStore((s) => s.boundPanelIds);
    const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
    const params = useWorkspaceStore((s) => s.panelParams.get(panelId));
    const { unbindPanel, markWorkspaceModified, setPanelParam, bindPanelToWorkspace } = useWorkspaceStore();
    const { data: projects } = useProjects();

    // Determine if this panel is bound to workspace
    const isBound = boundPanelIds.has(panelId);

    // Get project ID: bound panels use workspace project, unbound use their own
    const overrideProjectId = (params as { projectId?: string })?.projectId;
    const effectiveProjectId = isBound ? boundProjectId : overrideProjectId;

    // Get workspace color for styling
    const workspaceColor = activeWorkspaceId
        ? BUILT_IN_WORKSPACES.find((w) => w.id === activeWorkspaceId)?.color
        : null;

    // Handler for when user manually changes project in panel
    const handleProjectChange = (newProjectId: string) => {
        // Unbind from workspace, store override
        unbindPanel(panelId);
        setPanelParam(panelId, { projectId: newProjectId });
        markWorkspaceModified();
    };

    // Handler to rebind to workspace
    const handleRebind = () => {
        bindPanelToWorkspace(panelId);
        // Clear the override
        setPanelParam(panelId, {});
    };

    // Get current project title
    const currentProject = projects?.find((p) => p.id === effectiveProjectId);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Panel Header with Project Selector */}
            <div
                className={`h-10 px-3 border-b flex items-center justify-between shrink-0 ${
                    isBound && workspaceColor
                        ? `bg-${workspaceColor}-50 border-${workspaceColor}-200`
                        : 'bg-slate-50 border-slate-200'
                }`}
            >
                <Menu>
                    <Menu.Target>
                        <button
                            className={`flex items-center gap-2 px-2 py-1 rounded text-sm font-medium transition-colors ${
                                isBound && workspaceColor
                                    ? `text-${workspaceColor}-700 hover:bg-${workspaceColor}-100`
                                    : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            {currentProject?.title || 'Select Project'}
                            <ChevronDown size={14} />
                        </button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>Select Project</Menu.Label>
                        {projects?.map((p) => (
                            <Menu.Item
                                key={p.id}
                                onClick={() => handleProjectChange(p.id)}
                                leftSection={p.id === effectiveProjectId ? <Check size={14} /> : null}
                            >
                                {p.title}
                            </Menu.Item>
                        ))}
                        {!isBound && boundProjectId && (
                            <>
                                <Menu.Divider />
                                <Menu.Item onClick={handleRebind} leftSection={<Unlink size={14} />}>
                                    Re-bind to Workspace
                                </Menu.Item>
                            </>
                        )}
                    </Menu.Dropdown>
                </Menu>

                {/* Bound indicator */}
                {isBound && (
                    <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                            workspaceColor
                                ? `bg-${workspaceColor}-200 text-${workspaceColor}-700`
                                : 'bg-slate-200 text-slate-600'
                        }`}
                    >
                        Bound
                    </span>
                )}
            </div>

            {/* Project View */}
            <div className="flex-1 overflow-hidden">
                <ProjectView projectId={effectiveProjectId ?? null} className="h-full" />
            </div>
        </div>
    );
}

/**
 * Dockview adapter for ProjectPanel
 */
export function ProjectPanel(props: IDockviewPanelProps) {
    return (
        <div className="h-full overflow-hidden bg-white">
            <ProjectPanelContent panelId={props.api.id} />
        </div>
    );
}
