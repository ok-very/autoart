/**
 * WorkspaceContext
 *
 * Provides workspace state to panels via React Context instead of
 * direct Zustand store reads. Panels use useWorkspaceContext() to access
 * binding state, scope, and content type without coupling to store internals.
 *
 * Provider is wired in MainLayout wrapping the Dockview area.
 * Derived from workspaceStore + uiStore state.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { WorkspaceScope, CenterContentType } from '../types/workspace';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { BUILT_IN_WORKSPACES } from './workspacePresets';

export interface WorkspaceContextValue {
    /** Active workspace preset ID */
    workspaceId: string | null;
    /** Active subview within workspace */
    subviewId: string | null;
    /** Workspace's bound project */
    boundProjectId: string | null;
    /** Check if a panel is bound to the workspace project */
    isBound: (panelId: string) => boolean;
    /** Workspace scope: 'global' | 'project' | 'subprocess' */
    scope: WorkspaceScope | null;
    /** What center-workspace should display */
    contentType: CenterContentType;
    /** Content types this workspace can display. Null = no restriction. */
    ownedContentTypes: CenterContentType[] | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Hook to access workspace context. Throws if not within provider.
 */
export function useWorkspaceContext(): WorkspaceContextValue {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) {
        throw new Error('useWorkspaceContext must be used within WorkspaceContextProvider');
    }
    return ctx;
}

/**
 * Optional hook — returns null if not within provider.
 * Use in components that may render outside the workspace (e.g., overlays).
 */
export function useWorkspaceContextOptional(): WorkspaceContextValue | null {
    return useContext(WorkspaceContext);
}

interface WorkspaceContextProviderProps {
    children: ReactNode;
}

export function WorkspaceContextProvider({ children }: WorkspaceContextProviderProps) {
    const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
    const subviewId = useWorkspaceStore((s) => s.activeSubviewId);
    const boundProjectId = useWorkspaceStore((s) => s.boundProjectId);
    const boundPanelIds = useWorkspaceStore((s) => s.boundPanelIds);
    const contentType = useWorkspaceStore((s) => s.centerContentType);

    const preset = useMemo(
        () => workspaceId ? BUILT_IN_WORKSPACES.find((w) => w.id === workspaceId) ?? null : null,
        [workspaceId],
    );

    const scope = preset?.scope ?? null;
    const ownedContentTypes = preset?.ownedContentTypes ?? null;

    const isBound = useMemo(
        () => (panelId: string) => boundPanelIds.has(panelId),
        [boundPanelIds],
    );

    const value = useMemo<WorkspaceContextValue>(
        () => ({
            workspaceId,
            subviewId,
            boundProjectId,
            isBound,
            scope,
            contentType,
            ownedContentTypes,
        }),
        [workspaceId, subviewId, boundProjectId, isBound, scope, contentType, ownedContentTypes],
    );

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
