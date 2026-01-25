/**
 * Workspace Presets
 *
 * Built-in workspace configurations for the 5 workflow stages.
 * Each workspace opens specific panels and primes their default views.
 *
 * Workspaces are presets, not replacements - users can still change views
 * within panels after applying a workspace.
 */

import {
    ClipboardList,
    Layout,
    Play,
    CheckSquare,
    Truck,
    Folder,
    Image,
    Monitor,
} from 'lucide-react';
import type { WorkspacePreset } from '../types/workspace';

/**
 * Built-in workspaces for the 5 workflow stages:
 *
 * 1. Intake (global) - Import wizard, classification
 * 2. Plan (project) - Hierarchy view for task planning
 * 3. Act (project) - Registry view with composer for execution
 * 4. Review (subprocess) - Log view for reviewing completed work
 * 5. Deliver (project) - Export workbench for final output
 */
export const BUILT_IN_WORKSPACES: WorkspacePreset[] = [
    {
        id: 'collect',
        label: '0. Collect',
        icon: Image,
        color: 'cyan',
        scope: 'global',
        isBuiltIn: true,
        panels: [
            { panelId: 'artcollector-workbench', position: 'center' },
            { panelId: 'selection-inspector', position: 'right' },
        ],
    },
    {
        id: 'intake',
        label: '1. Intake',
        icon: ClipboardList,
        color: 'pink',
        scope: 'global',
        isBuiltIn: true,
        panels: [
            { panelId: 'intake-workbench', position: 'center' },
        ],
    },
    {
        id: 'plan',
        label: '2. Plan',
        icon: Layout,
        color: 'blue',
        scope: 'project',
        isBuiltIn: true,
        panels: [
            { panelId: 'center-workspace', viewMode: 'workflow', position: 'center' },
            { panelId: 'selection-inspector', position: 'right' },
        ],
    },
    {
        id: 'act',
        label: '3. Act',
        icon: Play,
        color: 'green',
        scope: 'project',
        isBuiltIn: true,
        panels: [
            { panelId: 'center-workspace', viewMode: 'workflow', position: 'center' },
            { panelId: 'selection-inspector', position: 'right' },
            { panelId: 'composer-workbench', position: 'bottom' },
        ],
    },
    {
        id: 'review',
        label: '4. Review',
        icon: CheckSquare,
        color: 'purple',
        scope: 'subprocess',
        isBuiltIn: true,
        panels: [
            { panelId: 'center-workspace', viewMode: 'log', position: 'center' },
            { panelId: 'selection-inspector', position: 'right' },
        ],
    },
    {
        id: 'deliver',
        label: '5. Deliver',
        icon: Truck,
        color: 'orange',
        scope: 'project',
        isBuiltIn: true,
        panels: [
            { panelId: 'export-workbench', position: 'center' },
        ],
    },
    {
        id: 'desk',
        label: 'Desk',
        icon: Monitor,
        color: 'amber',
        scope: 'global',
        isBuiltIn: true,
        panels: [
            { panelId: 'project-panel', position: 'center', bound: true },
            { panelId: 'project-panel', position: 'center', bound: true },
            { panelId: 'project-panel', position: 'center', bound: true },
            { panelId: 'mail-panel', position: 'right' },
        ],
    },
];

/**
 * Default icon for user-created workspaces
 */
export const DEFAULT_CUSTOM_WORKSPACE_ICON = Folder;

/**
 * Get a workspace preset by ID (built-in only)
 */
export function getBuiltInWorkspace(id: string): WorkspacePreset | undefined {
    return BUILT_IN_WORKSPACES.find(w => w.id === id);
}

/**
 * Get all built-in workspace IDs
 */
export function getBuiltInWorkspaceIds(): string[] {
    return BUILT_IN_WORKSPACES.map(w => w.id);
}
