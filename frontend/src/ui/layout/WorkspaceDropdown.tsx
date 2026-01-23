/**
 * WorkspaceDropdown
 *
 * Blender-style workspace switcher dropdown.
 * Shows built-in workspaces (Intake, Plan, Act, Review, Deliver) plus
 * user-created custom workspaces. Includes "+ Add Workspace" option.
 */

import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@autoart/ui';
import { Menu } from '@autoart/ui';
import { useWorkspaceStore, useActiveWorkspaceId } from '../../stores/workspaceStore';
import { BUILT_IN_WORKSPACES } from '../../workspace/workspacePresets';
import type { WorkspacePreset } from '../../types/workspace';
import { AddWorkspaceDialog } from './AddWorkspaceDialog';

/**
 * Color mapping for workspace accent colors
 */
const WORKSPACE_COLORS: Record<string, string> = {
    pink: 'bg-pink-100 text-pink-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    slate: 'bg-slate-100 text-slate-700',
};

/**
 * Get the active color classes for a workspace
 */
function getActiveColorClass(color: string): string {
    const colorMap: Record<string, string> = {
        pink: 'bg-pink-50',
        blue: 'bg-blue-50',
        green: 'bg-green-50',
        purple: 'bg-purple-50',
        orange: 'bg-orange-50',
        slate: 'bg-slate-50',
    };
    return colorMap[color] ?? 'bg-slate-50';
}

interface WorkspaceMenuItemProps {
    workspace: WorkspacePreset;
    isActive: boolean;
    onSelect: () => void;
    onDelete?: () => void;
}

function WorkspaceMenuItem({ workspace, isActive, onSelect, onDelete }: WorkspaceMenuItemProps) {
    const Icon = workspace.icon;
    const colorClasses = WORKSPACE_COLORS[workspace.color] ?? WORKSPACE_COLORS.slate;

    return (
        <Menu.Item
            onClick={onSelect}
            leftSection={
                <span className={`p-1 rounded ${colorClasses}`}>
                    <Icon size={14} />
                </span>
            }
            rightSection={
                onDelete ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete workspace"
                    >
                        <Trash2 size={12} />
                    </button>
                ) : undefined
            }
            className={isActive ? getActiveColorClass(workspace.color) : ''}
        >
            {workspace.label}
        </Menu.Item>
    );
}

export function WorkspaceDropdown() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const activeWorkspaceId = useActiveWorkspaceId();
    const { applyWorkspace, customWorkspaces, deleteCustomWorkspace, getAllWorkspaces } = useWorkspaceStore();

    const allWorkspaces = getAllWorkspaces();
    const activeWorkspace = allWorkspaces.find(w => w.id === activeWorkspaceId);

    const handleSelectWorkspace = (workspaceId: string) => {
        applyWorkspace(workspaceId);
    };

    const handleAddWorkspace = () => {
        setDialogOpen(true);
    };

    const handleDeleteWorkspace = (id: string) => {
        deleteCustomWorkspace(id);
    };

    // Determine button styling based on active workspace
    const buttonColor = activeWorkspace?.color ?? 'gray';
    const hasActiveWorkspace = !!activeWorkspace;

    return (
        <>
            <Menu>
                <Menu.Target>
                    <Button
                        variant={hasActiveWorkspace ? 'light' : 'subtle'}
                        color={hasActiveWorkspace ? buttonColor : 'gray'}
                        size="sm"
                        rightSection={<ChevronDown size={14} />}
                        leftSection={activeWorkspace ? <activeWorkspace.icon size={14} /> : undefined}
                    >
                        {activeWorkspace?.label ?? 'Workspace'}
                    </Button>
                </Menu.Target>

                <Menu.Dropdown>
                    {/* Built-in workspaces */}
                    <Menu.Label>Workspaces</Menu.Label>
                    {BUILT_IN_WORKSPACES.map((workspace) => (
                        <WorkspaceMenuItem
                            key={workspace.id}
                            workspace={workspace}
                            isActive={activeWorkspaceId === workspace.id}
                            onSelect={() => handleSelectWorkspace(workspace.id)}
                        />
                    ))}

                    {/* Custom workspaces (if any) */}
                    {customWorkspaces.length > 0 && (
                        <>
                            <Menu.Divider />
                            <Menu.Label>Custom</Menu.Label>
                            {customWorkspaces.map((workspace) => (
                                <WorkspaceMenuItem
                                    key={workspace.id}
                                    workspace={workspace}
                                    isActive={activeWorkspaceId === workspace.id}
                                    onSelect={() => handleSelectWorkspace(workspace.id)}
                                    onDelete={() => handleDeleteWorkspace(workspace.id)}
                                />
                            ))}
                        </>
                    )}

                    {/* Add workspace option */}
                    <Menu.Divider />
                    <Menu.Item
                        onClick={handleAddWorkspace}
                        leftSection={<Plus size={14} />}
                        className="text-blue-600"
                    >
                        Add Workspace
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>

            {/* Add Workspace Dialog */}
            <AddWorkspaceDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
            />
        </>
    );
}
