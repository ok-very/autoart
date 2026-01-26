/**
 * ActionInstancesView
 *
 * Page-level view for action instances.
 * - When definitionId is provided: shows actions for that specific definition
 * - When definitionId is null: shows all actions
 *
 * Architecture:
 * - Uses useAllActionsByDefinition for specific definition lookup
 * - Uses useAllActions for "all actions" view
 * - Delegates rendering to ActionsTableFlat composite
 */

import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { useCallback } from 'react';

import {
    useAllActionsByDefinition,
    useRecordDefinition,
} from '../../api/hooks';
import { useAllActions } from '../../api/hooks/actions/actions';
import { useUIStore } from '../../stores/uiStore';
import { ActionsTableFlat } from '../../ui/composites';

// ==================== TYPES ====================

export interface ActionInstancesViewProps {
    /** Selected action definition ID (null = show all actions) */
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
    const { inspectAction, openOverlay, selection } = useUIStore();
    const { data: definition, isLoading: definitionLoading } = useRecordDefinition(definitionId);

    // Fetch actions - use specific definition lookup if ID provided, otherwise all actions
    // Fetch actions - use specific definition lookup if ID provided, otherwise all actions
    const { data: filteredActions = [], isLoading: filteredLoading } = useAllActionsByDefinition(definitionId);
    const { data: allActionsData, isLoading: allLoading } = useAllActions({ refetch: !definitionId });
    const allActions = allActionsData?.actions ?? [];

    // Use appropriate data source
    const actions = definitionId ? filteredActions : allActions;
    const actionsLoading = definitionId ? filteredLoading : allLoading;
    const isLoading = (definitionId ? definitionLoading : false) || actionsLoading;

    // Get currently selected action ID
    const selectedActionId = selection?.type === 'action' ? selection.id : null;

    // Handlers
    const handleSelectAction = useCallback((actionId: string) => {
        inspectAction(actionId);
    }, [inspectAction]);

    const handleCreateAction = useCallback(() => {
        if (definitionId) {
            openOverlay('composer', { recipeId: definitionId });
        } else {
            // Navigate to composer without recipe
            window.location.href = '/composer';
        }
    }, [definitionId, openOverlay]);

    // Toolbar header
    const renderHeader = useCallback(() => {
        const title = definition ? definition.name : 'All Actions';
        const icon = definition?.styling?.icon;

        return (
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                    {/* Definition badge */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                        {icon && <span>{icon}</span>}
                        <span className="text-sm font-medium text-purple-700">{title}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                        {actions.length} instance{actions.length !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCreateAction}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
                    >
                        <Plus size={14} />
                        Create {definition?.name || 'Action'}
                    </button>
                </div>
            </div>
        );
    }, [definition, actions.length, handleCreateAction]);

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
