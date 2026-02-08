/**
 * WorkspaceDropdown
 *
 * Blender-style workspace switcher dropdown.
 * Shows built-in workspaces with nested submenus that include both
 * built-in subviews and user-created custom views scoped to each workspace.
 * Each submenu has a "+" action to save the current arrangement into that category.
 */

import { ChevronDown, Copy, Dna, Folder, Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button, type ButtonColor } from '@autoart/ui';
import { Menu } from '@autoart/ui';
import { Modal, Inline, Text } from '@autoart/ui';
import { useWorkspaceStore, useActiveWorkspaceId, useActiveSubviewId, useCustomWorkspaces } from '../../stores/workspaceStore';
import { BUILT_IN_WORKSPACES } from '../../workspace/workspacePresets';
import type { WorkspacePreset, WorkspaceSubview } from '../../types/workspace';
import { AddWorkspaceDialog } from './AddWorkspaceDialog';

/**
 * Unified color configuration for workspace styling.
 * Single source of truth to prevent drift between icon and active states.
 */
const WORKSPACE_COLOR_CONFIG: Record<string, { icon: string; active: string }> = {
    // Chromatic — warm to cool
    red: { icon: 'bg-red-100 text-red-700', active: 'bg-red-50' },
    orange: { icon: 'bg-orange-100 text-orange-700', active: 'bg-orange-50' },
    amber: { icon: 'bg-amber-100 text-amber-700', active: 'bg-amber-50' },
    yellow: { icon: 'bg-yellow-100 text-yellow-700', active: 'bg-yellow-50' },
    lime: { icon: 'bg-lime-100 text-lime-700', active: 'bg-lime-50' },
    green: { icon: 'bg-green-100 text-green-700', active: 'bg-green-50' },
    emerald: { icon: 'bg-emerald-100 text-emerald-700', active: 'bg-emerald-50' },
    teal: { icon: 'bg-teal-100 text-teal-700', active: 'bg-teal-50' },
    cyan: { icon: 'bg-cyan-100 text-cyan-700', active: 'bg-cyan-50' },
    sky: { icon: 'bg-sky-100 text-sky-700', active: 'bg-sky-50' },
    blue: { icon: 'bg-blue-100 text-blue-700', active: 'bg-blue-50' },
    indigo: { icon: 'bg-indigo-100 text-indigo-700', active: 'bg-indigo-50' },
    violet: { icon: 'bg-violet-100 text-violet-700', active: 'bg-violet-50' },
    purple: { icon: 'bg-purple-100 text-purple-700', active: 'bg-purple-50' },
    fuchsia: { icon: 'bg-fuchsia-100 text-fuchsia-700', active: 'bg-fuchsia-50' },
    pink: { icon: 'bg-pink-100 text-pink-700', active: 'bg-pink-50' },
    rose: { icon: 'bg-rose-100 text-rose-700', active: 'bg-rose-50' },
    // Neutrals
    slate: { icon: 'bg-slate-100 text-ws-text-secondary', active: 'bg-ws-bg' },
    gray: { icon: 'bg-gray-100 text-gray-700', active: 'bg-gray-50' },
    zinc: { icon: 'bg-zinc-100 text-zinc-700', active: 'bg-zinc-50' },
    neutral: { icon: 'bg-neutral-100 text-neutral-700', active: 'bg-neutral-50' },
    stone: { icon: 'bg-stone-100 text-stone-700', active: 'bg-stone-50' },
};

const DEFAULT_COLOR = 'slate';

/**
 * Maps workspace colors to Button component colors.
 * Each workspace color maps to the closest available button color.
 */
const BUTTON_COLOR_MAP: Record<string, ButtonColor> = {
    // Chromatic — warm to cool
    red: 'red',
    orange: 'orange',
    amber: 'yellow',
    yellow: 'yellow',
    lime: 'green',
    green: 'green',
    emerald: 'teal',
    teal: 'teal',
    cyan: 'cyan',
    sky: 'cyan',
    blue: 'blue',
    indigo: 'indigo',
    violet: 'violet',
    purple: 'violet',
    fuchsia: 'pink',
    pink: 'pink',
    rose: 'rose',
    // Neutrals
    slate: 'gray',
    gray: 'gray',
    zinc: 'gray',
    neutral: 'gray',
    stone: 'gray',
};

function getButtonColor(workspaceColor: string): ButtonColor {
    return BUTTON_COLOR_MAP[workspaceColor] ?? 'gray';
}

function getIconColorClass(color: string): string {
    return WORKSPACE_COLOR_CONFIG[color]?.icon ?? WORKSPACE_COLOR_CONFIG[DEFAULT_COLOR].icon;
}

function getActiveColorClass(color: string): string {
    return WORKSPACE_COLOR_CONFIG[color]?.active ?? WORKSPACE_COLOR_CONFIG[DEFAULT_COLOR].active;
}

/** Inline hover actions for custom workspace items (duplicate + delete) */
function CustomItemActions({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
    return (
        <span className="flex items-center gap-0.5 opacity-0 group-hover/custom:opacity-100 transition-opacity">
            <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDuplicate(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onDuplicate(); } }}
                className="p-1 hover:bg-slate-200 rounded text-ws-muted hover:text-ws-text-secondary transition-colors cursor-pointer"
                title="Duplicate"
            >
                <Copy size={12} />
            </span>
            <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onDelete(); } }}
                className="p-1 hover:bg-red-100 rounded text-ws-muted hover:text-red-600 transition-colors cursor-pointer"
                title="Delete"
            >
                <Trash2 size={12} />
            </span>
        </span>
    );
}

/** Hover-reveal duplicate action for built-in subview items */
function SubviewDuplicateAction({ onDuplicate }: { onDuplicate: () => void }) {
    return (
        <span className="opacity-0 group-hover/subview:opacity-100 transition-opacity">
            <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDuplicate(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onDuplicate(); } }}
                className="p-1 hover:bg-slate-200 rounded text-ws-muted hover:text-ws-text-secondary transition-colors cursor-pointer"
                title="Duplicate as custom view"
            >
                <Copy size={12} />
            </span>
        </span>
    );
}

interface WorkspaceMenuEntryProps {
    workspace: WorkspacePreset;
    customChildren: WorkspacePreset[];
    isActive: boolean;
    isAnyChildActive: boolean;
    activeWorkspaceId: string | null;
    activeSubviewId: string | null;
    onSelect: (workspaceId: string, subviewId?: string) => void;
    onOpenAddDialog: (parentWorkspaceId: string) => void;
    onDeleteCustom: (id: string) => void;
    onDuplicateCustom: (id: string) => void;
    onDuplicateSubview: (parentId: string, subview: WorkspaceSubview) => void;
}

function WorkspaceMenuEntry({
    workspace,
    customChildren,
    isActive,
    isAnyChildActive,
    activeWorkspaceId,
    activeSubviewId,
    onSelect,
    onOpenAddDialog,
    onDeleteCustom,
    onDuplicateCustom,
    onDuplicateSubview,
}: WorkspaceMenuEntryProps) {
    const Icon = workspace.icon ?? Folder;
    const colorClasses = getIconColorClass(workspace.color);
    const subviewCount = workspace.subviews?.length ?? 0;
    const hasSubmenu = subviewCount > 0 || customChildren.length > 0;

    const iconElement = (
        <span className={`p-1 rounded ${colorClasses}`}>
            <Icon size={14} />
        </span>
    );

    // Submenu: built-in with multiple subviews, or any with custom children
    if (hasSubmenu) {
        const triggerActive = isActive || isAnyChildActive;

        return (
            <Menu.Sub>
                <Menu.SubTrigger
                    leftSection={iconElement}
                    className={triggerActive ? getActiveColorClass(workspace.color) : ''}
                >
                    {workspace.label}
                </Menu.SubTrigger>
                <Menu.SubContent>
                    {/* Built-in subviews */}
                    {workspace.subviews?.map((subview) => {
                        const isSubviewActive = isActive && activeSubviewId === subview.id;
                        return (
                            <div key={subview.id} className="group/subview">
                                <Menu.Item
                                    onClick={() => onSelect(workspace.id, subview.id)}
                                    className={isSubviewActive ? getActiveColorClass(workspace.color) : ''}
                                    rightSection={
                                        <SubviewDuplicateAction
                                            onDuplicate={() => onDuplicateSubview(workspace.id, subview)}
                                        />
                                    }
                                >
                                    {subview.label}
                                </Menu.Item>
                            </div>
                        );
                    })}

                    {/* Custom children scoped to this workspace */}
                    {customChildren.length > 0 && (
                        <>
                            <Menu.Divider />
                            {customChildren.map((child) => {
                                const isChildActive = activeWorkspaceId === child.id;
                                return (
                                    <div key={child.id} className="group/custom">
                                        <Menu.Item
                                            onClick={() => onSelect(child.id)}
                                            className={isChildActive ? getActiveColorClass(child.color) : ''}
                                            rightSection={
                                                <CustomItemActions
                                                    onDuplicate={() => onDuplicateCustom(child.id)}
                                                    onDelete={() => onDeleteCustom(child.id)}
                                                />
                                            }
                                        >
                                            {child.label}
                                        </Menu.Item>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* "+" Save current arrangement into this workspace */}
                    <Menu.Divider />
                    <Menu.Item
                        onClick={() => onOpenAddDialog(workspace.id)}
                        leftSection={<Plus size={14} />}
                        className="text-ws-text-secondary"
                    >
                        Save current
                    </Menu.Item>
                </Menu.SubContent>
            </Menu.Sub>
        );
    }

    // Flat item: single-subview built-in with no custom children
    return (
        <Menu.Item
            onClick={() => onSelect(workspace.id)}
            leftSection={iconElement}
            className={isActive ? getActiveColorClass(workspace.color) : ''}
        >
            {workspace.label}
        </Menu.Item>
    );
}

export function WorkspaceDropdown() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogParentId, setDialogParentId] = useState<string | undefined>();
    const [dialogDefaultColor, setDialogDefaultColor] = useState<string | undefined>();
    const [confirmTarget, setConfirmTarget] = useState<{ workspaceId: string; subviewId?: string } | null>(null);
    const activeWorkspaceId = useActiveWorkspaceId();
    const activeSubviewId = useActiveSubviewId();
    const customWorkspaces = useCustomWorkspaces();
    const workspaceModified = useWorkspaceStore((s) => s.workspaceModified);

    // Combine built-in + custom workspaces for resolving the active workspace label
    const allWorkspaces = [...BUILT_IN_WORKSPACES, ...customWorkspaces];
    const activeWorkspace = allWorkspaces.find(w => w.id === activeWorkspaceId);
    const isCustomActive = activeWorkspace && !activeWorkspace.isBuiltIn;
    const buttonColor = getButtonColor(activeWorkspace?.color ?? DEFAULT_COLOR);

    // Partition custom workspaces: scoped (have parentWorkspaceId) vs legacy (no parent)
    const legacyCustom = customWorkspaces.filter(w => !w.parentWorkspaceId);

    const doApply = useCallback((workspaceId: string, subviewId?: string) => {
        useWorkspaceStore.getState().applyWorkspace(workspaceId, subviewId);
    }, []);

    const handleSelectWorkspace = useCallback((workspaceId: string, subviewId?: string) => {
        if (workspaceModified && workspaceId !== activeWorkspaceId) {
            setConfirmTarget({ workspaceId, subviewId });
            return;
        }
        doApply(workspaceId, subviewId);
    }, [workspaceModified, activeWorkspaceId, doApply]);

    const handleOpenAddDialog = (parentWorkspaceId?: string) => {
        const parentColor = parentWorkspaceId
            ? BUILT_IN_WORKSPACES.find(w => w.id === parentWorkspaceId)?.color
            : undefined;
        setDialogParentId(parentWorkspaceId);
        setDialogDefaultColor(parentColor);
        // Defer dialog open to next frame so Radix DropdownMenu completes its
        // close + focus-restore cycle before the dialog mounts and traps focus.
        requestAnimationFrame(() => setDialogOpen(true));
    };

    const handleDeleteCustom = (id: string) => {
        useWorkspaceStore.getState().deleteCustomWorkspace(id);
    };

    const handleDuplicateCustom = (id: string) => {
        useWorkspaceStore.getState().duplicateCustomWorkspace(id);
    };

    const handleDuplicateSubview = (parentId: string, subview: WorkspaceSubview) => {
        useWorkspaceStore.getState().duplicateSubview(parentId, subview.id, `${subview.label} (custom)`);
    };

    return (
        <>
            <Menu>
                <Menu.Target>
                    <Button
                        variant="subtle"
                        color={buttonColor}
                        size="sm"
                        rightSection={<ChevronDown size={14} />}
                        leftSection={<Dna size={14} />}
                    >
                        {activeWorkspace?.label ?? 'Workspaces'}
                        {workspaceModified && (
                            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-ws-color-warning inline-block" title="Unsaved changes" />
                        )}
                    </Button>
                </Menu.Target>

                <Menu.Dropdown>
                    <Menu.Label>Workspaces</Menu.Label>
                    {BUILT_IN_WORKSPACES.map((workspace) => {
                        const scopedChildren = customWorkspaces.filter(
                            w => w.parentWorkspaceId === workspace.id,
                        );
                        const isAnyChildActive = scopedChildren.some(
                            w => w.id === activeWorkspaceId,
                        );

                        return (
                            <WorkspaceMenuEntry
                                key={workspace.id}
                                workspace={workspace}
                                customChildren={scopedChildren}
                                isActive={activeWorkspaceId === workspace.id}
                                isAnyChildActive={isAnyChildActive}
                                activeWorkspaceId={activeWorkspaceId}
                                activeSubviewId={activeSubviewId}
                                onSelect={handleSelectWorkspace}
                                onOpenAddDialog={handleOpenAddDialog}
                                onDeleteCustom={handleDeleteCustom}
                                onDuplicateCustom={handleDuplicateCustom}
                                onDuplicateSubview={handleDuplicateSubview}
                            />
                        );
                    })}

                    {/* Legacy custom workspaces (no parentWorkspaceId) - backward compat */}
                    {legacyCustom.length > 0 && (
                        <>
                            <Menu.Divider />
                            <Menu.Label>Custom</Menu.Label>
                            {legacyCustom.map((workspace) => {
                                const Icon = workspace.icon ?? Folder;
                                const colorClasses = getIconColorClass(workspace.color);
                                const isLegacyActive = activeWorkspaceId === workspace.id;

                                return (
                                    <div key={workspace.id} className="group/custom">
                                        <Menu.Item
                                            onClick={() => handleSelectWorkspace(workspace.id)}
                                            leftSection={
                                                <span className={`p-1 rounded ${colorClasses}`}>
                                                    <Icon size={14} />
                                                </span>
                                            }
                                            rightSection={
                                                <CustomItemActions
                                                    onDuplicate={() => handleDuplicateCustom(workspace.id)}
                                                    onDelete={() => handleDeleteCustom(workspace.id)}
                                                />
                                            }
                                            className={isLegacyActive ? getActiveColorClass(workspace.color) : ''}
                                        >
                                            {workspace.label}
                                        </Menu.Item>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </Menu.Dropdown>
            </Menu>

            <AddWorkspaceDialog
                key={dialogParentId ?? 'global'}
                open={dialogOpen}
                onClose={() => {
                    setDialogOpen(false);
                    setDialogParentId(undefined);
                    setDialogDefaultColor(undefined);
                }}
                parentWorkspaceId={dialogParentId}
                defaultColor={dialogDefaultColor}
            />

            {/* Confirmation dialog when switching workspaces with unsaved changes */}
            <Modal
                open={!!confirmTarget}
                onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}
                title="Unsaved workspace changes"
                description="You have modified the current workspace layout."
                size="sm"
            >
                <div className="space-y-3">
                    <Text size="sm" className="text-ws-text-secondary">
                        {isCustomActive
                            ? 'Save changes to the current workspace, save as a new workspace, or discard?'
                            : 'Save as a new workspace or discard changes?'}
                    </Text>
                    <Inline gap="sm" justify="end" className="pt-2">
                        <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (confirmTarget) doApply(confirmTarget.workspaceId, confirmTarget.subviewId);
                                setConfirmTarget(null);
                            }}
                        >
                            Discard
                        </Button>
                        {isCustomActive && (
                            <Button
                                variant="primary"
                                leftSection={<Save size={14} />}
                                onClick={() => {
                                    if (activeWorkspaceId) {
                                        useWorkspaceStore.getState().updateCustomWorkspace(activeWorkspaceId);
                                    }
                                    if (confirmTarget) doApply(confirmTarget.workspaceId, confirmTarget.subviewId);
                                    setConfirmTarget(null);
                                }}
                            >
                                Update
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            onClick={() => {
                                setConfirmTarget(null);
                                handleOpenAddDialog();
                            }}
                        >
                            Save as new
                        </Button>
                    </Inline>
                </div>
            </Modal>
        </>
    );
}
