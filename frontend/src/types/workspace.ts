/**
 * Workspace Types
 *
 * Defines workspace presets - saved panel configurations that prime the UI
 * for specific workflow stages.
 */

import type { LucideIcon } from 'lucide-react';
import type { PanelId } from '../workspace/panelRegistry';
import type { CenterContentType } from '../stores/uiStore';

/**
 * Scope determines when a workspace is available:
 * - global: Always accessible (e.g., Intake)
 * - project: Requires active project (e.g., Plan, Act, Deliver)
 * - subprocess: Requires active subprocess (e.g., Review)
 */
export type WorkspaceScope = 'global' | 'project' | 'subprocess';

/**
 * Panel configuration within a workspace preset.
 * Specifies which panel to open and optionally what view mode to set.
 */
export interface WorkspacePanelConfig {
    /** Panel ID from panelRegistry */
    panelId: PanelId;
    /** Optional view mode to set when workspace is applied */
    viewMode?: string;
    /** Default position hint (actual position determined by Dockview) */
    position?: 'center' | 'left' | 'right' | 'bottom';
    /** If true, panel follows workspace's bound project */
    bound?: boolean;
    /** For center-workspace, specify what content type to display */
    contentType?: CenterContentType;
}

/**
 * A named sub-configuration within a workspace.
 * Single-subview workspaces render as flat menu items;
 * multi-subview workspaces render as nested submenus.
 */
export interface WorkspaceSubview {
    id: string;
    label: string;
    panels: WorkspacePanelConfig[];
}

/**
 * Workspace Preset
 *
 * A saved configuration that opens specific panels and primes their views.
 * Built-in workspaces are defined in workspacePresets.ts.
 * User-created workspaces are stored in localStorage.
 */
export interface WorkspacePreset {
    /** Unique identifier */
    id: string;
    /** Display label (e.g., "1. Intake", "2. Plan") */
    label: string;
    /** Icon to display in dropdown */
    icon: LucideIcon;
    /** Tailwind color for accent (e.g., 'pink', 'blue') */
    color: string;
    /** When this workspace is available */
    scope: WorkspaceScope;
    /** Whether this is a built-in workspace (vs user-created) */
    isBuiltIn: boolean;
    /** Scopes this custom workspace under a built-in workspace's submenu */
    parentWorkspaceId?: string;
    /** Content types this workspace can display in center-workspace. Router validates against this. */
    ownedContentTypes?: CenterContentType[];
    /** @deprecated Use subviews instead. Kept for backward compat with custom workspaces. */
    panels: WorkspacePanelConfig[];
    /** Named sub-configurations. Built-in workspaces should use this. */
    subviews?: WorkspaceSubview[];
}

/**
 * Persisted workspace preset (for localStorage).
 * Icon is omitted since it cannot be serialized; it's reattached on load.
 */
export type PersistedWorkspacePreset = Omit<WorkspacePreset, 'icon'>;

/**
 * Captured panel state for saving custom workspaces.
 */
export interface CapturedPanelState {
    id: PanelId;
    currentViewMode?: string;
    position?: 'center' | 'left' | 'right' | 'bottom';
}

/**
 * State captured when user saves current arrangement as workspace.
 */
export interface CapturedWorkspaceState {
    openPanels: CapturedPanelState[];
}
