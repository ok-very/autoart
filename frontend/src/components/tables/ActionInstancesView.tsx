/**
 * ActionInstancesView
 *
 * Page-level view for action instances of a specific action type (recipe).
 * Used in the Registry page when an action type is selected.
 *
 * Architecture:
 * - Fetches data via useAllActionsByType hook
 * - Delegates rendering to ActionsTableFlat composite
 * - This is a thin orchestration layer, not a reusable composite
 */

import { useCallback } from 'react';
import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import {
    useAllActionsByType,
    useRecordDefinition,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import { ActionsTableFlat } from '../../ui/composites';

// ==================== TYPES ====================

export interface ActionInstancesViewProps {
    /** Selected action type definition ID */
    definitionId: string | null;
    /** Custom className */
    className?: string;
}

// ==================== MAIN COMPONENT ====================

export function ActionInstancesView({
    definitionId,
    className,
}: ActionInstancesViewProps) {
    // Hooks
    const { inspectAction, openDrawer, selection } = useUIStore();
    const { data: definition, isLoading: definitionLoading } = useRecordDefinition(definitionId);

    // Get action type name from definition
    const actionTypeName = definition?.name ?? null;

    // Fetch actions of this type
    const { data: actions = [], isLoading: actionsLoading } = useAllActionsByType(actionTypeName);

    const isLoading = definitionLoading || actionsLoading;

    // Get currently selected action ID
    const selectedActionId = selection?.type === 'action' ? selection.id : null;

    // Handlers
    const handleSelectAction = useCallback((actionId: string) => {
        inspectAction(actionId);
    }, [inspectAction]);

    const handleCreateAction = useCallback(() => {
        if (definitionId) {
            openDrawer('composer', { recipeId: definitionId });
        }
    }, [definitionId, openDrawer]);

    // Toolbar header
    const renderHeader = useCallback(() => {
        if (!definition) return null;

        return (
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                    {/* Type badge */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                        {definition.styling?.icon && <span>{definition.styling.icon}</span>}
                        <span className="text-sm font-medium text-purple-700">{definition.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                        {actions.length} instance{actions.length !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {definitionId && (
                        <button
                            onClick={handleCreateAction}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
                        >
                            <Plus size={14} />
                            Create {definition?.name || 'Action'}
                        </button>
                    )}
                </div>
            </div>
        );
    }, [definition, definitionId, actions.length, handleCreateAction]);

    return (
        <div className={clsx('flex flex-col h-full bg-slate-50', className)}>
            <ActionsTableFlat
                actions={actions}
                definition={definition ?? null}
                isLoading={isLoading}
                selectedActionId={selectedActionId}
                onRowSelect={handleSelectAction}
                onAddAction={handleCreateAction}
                renderHeader={renderHeader}
                emptyMessage={`No ${definition?.name || 'actions'} found`}
                className="h-full"
            />
        </div>
    );
}
