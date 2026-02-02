/**
 * ContextIndicator
 *
 * Displays the derived context for action declaration.
 * Context is automatically derived from current selection/navigation,
 * not explicitly selected by the user.
 *
 * Shows: Project → Subprocess (or Stage → Action context)
 */

import { clsx } from 'clsx';
import { ChevronRight, FolderKanban, GitBranch, Target } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@autoart/ui';

import type { ContextType } from '@autoart/shared';
import { useProjects, useNode, useAction, useSubprocesses } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';

export interface DerivedContext {
    projectId: string | null;
    projectTitle: string | null;
    contextId: string | null;
    contextTitle: string | null;
    contextType: ContextType;
    parentActionId?: string | null;
    parentActionTitle?: string | null;
}

export interface ContextIndicatorProps {
    /** Override the derived context (for controlled usage) */
    context?: Partial<DerivedContext>;
    /** Size variant */
    size?: 'sm' | 'md';
    /** Additional className */
    className?: string;
}

/**
 * Hook to derive context from current selection
 */
export function useDerivedContext(): DerivedContext {
    const { selection, activeProjectId } = useUIStore();

    // Get context from selection
    const nodeId = selection?.type === 'node' ? selection.id : null;
    const actionId = selection?.type === 'action' ? selection.id : null;

    const { data: projects } = useProjects();
    const { data: selectedNode } = useNode(nodeId);
    const { data: selectedAction } = useAction(actionId);
    const { data: subprocesses } = useSubprocesses(activeProjectId);

    // Find the active project from the projects list
    const project = useMemo(() => {
        if (!activeProjectId || !projects) return null;
        return projects.find((p) => p.id === activeProjectId) || null;
    }, [activeProjectId, projects]);

    return useMemo(() => {
        // Default context
        const defaultContext: DerivedContext = {
            projectId: activeProjectId,
            projectTitle: project?.title || null,
            contextId: null,
            contextTitle: null,
            contextType: 'subprocess',
            parentActionId: null,
            parentActionTitle: null,
        };

        // If we have a selected node, derive context from it
        if (selectedNode) {
            const isSubprocess = selectedNode.type === 'subprocess';
            const isStage = selectedNode.type === 'stage';

            if (isSubprocess || isStage) {
                return {
                    ...defaultContext,
                    contextId: selectedNode.id,
                    contextTitle: selectedNode.title,
                    contextType: isStage ? 'stage' : 'subprocess',
                };
            }

            // For tasks, use parent subprocess
            if (selectedNode.parent_id) {
                return {
                    ...defaultContext,
                    contextId: selectedNode.parent_id,
                    contextTitle: selectedNode.title,
                    contextType: 'subprocess',
                };
            }
        }

        // If we have a selected action, derive context from it
        if (selectedAction) {
            return {
                ...defaultContext,
                contextId: selectedAction.contextId,
                contextTitle: null, // Would need to fetch context details
                contextType: selectedAction.contextType,
                parentActionId: selectedAction.id,
                parentActionTitle: (selectedAction.fieldBindings as Array<{ fieldKey: string; value?: unknown }>)
                    ?.find((b) => b.fieldKey === 'title')?.value as string || selectedAction.type,
            };
        }

        // Fallback to first subprocess in project
        if (subprocesses && subprocesses.length > 0) {
            const firstSubprocess = subprocesses[0];
            const titleBinding = (firstSubprocess.fieldBindings as Array<{ fieldKey: string; value?: unknown }>)
                ?.find((b) => b.fieldKey === 'title');
            return {
                ...defaultContext,
                contextId: firstSubprocess.id,
                contextTitle: String(titleBinding?.value || firstSubprocess.type || 'Subprocess'),
                contextType: 'subprocess',
            };
        }

        return defaultContext;
    }, [activeProjectId, project, selectedNode, selectedAction, subprocesses]);
}

/**
 * ContextIndicator Component
 */
export function ContextIndicator({
    context: contextOverride,
    size = 'sm',
    className,
}: ContextIndicatorProps) {
    const derivedContext = useDerivedContext();
    const context = { ...derivedContext, ...contextOverride };

    const { projectTitle, contextTitle, contextType, parentActionTitle } = context;

    // No context available
    if (!projectTitle && !contextTitle) {
        return (
            <div className={clsx(
                'flex items-center gap-1.5 text-ws-muted',
                size === 'sm' ? 'text-xs' : 'text-sm',
                className
            )}>
                <Target size={size === 'sm' ? 12 : 14} />
                <span>No context selected</span>
            </div>
        );
    }

    const iconSize = size === 'sm' ? 12 : 14;
    const chevronSize = size === 'sm' ? 10 : 12;

    return (
        <div className={clsx(
            'flex items-center gap-1',
            size === 'sm' ? 'text-xs' : 'text-sm',
            className
        )}>
            {/* Project */}
            {projectTitle && (
                <>
                    <div className="flex items-center gap-1 text-ws-text-secondary">
                        <FolderKanban size={iconSize} className="text-blue-500" />
                        <span className="font-medium truncate max-w-[120px]">{projectTitle}</span>
                    </div>
                    <ChevronRight size={chevronSize} className="text-ws-muted shrink-0" />
                </>
            )}

            {/* Context (Subprocess/Stage) */}
            {contextTitle && (
                <>
                    <div className="flex items-center gap-1">
                        <GitBranch size={iconSize} className="text-orange-500" />
                        <Badge
                            variant={contextType === 'stage' ? 'stage' : 'subprocess'}
                            size={size === 'sm' ? 'xs' : 'sm'}
                        >
                            {contextTitle}
                        </Badge>
                    </div>
                </>
            )}

            {/* Parent Action (for subtasks) */}
            {parentActionTitle && (
                <>
                    <ChevronRight size={chevronSize} className="text-ws-muted shrink-0" />
                    <div className="flex items-center gap-1 text-ws-text-secondary">
                        <Target size={iconSize} className="text-green-500" />
                        <span className="truncate max-w-[100px]">{parentActionTitle}</span>
                    </div>
                </>
            )}
        </div>
    );
}

export default ContextIndicator;
