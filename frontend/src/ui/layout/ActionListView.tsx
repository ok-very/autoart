/**
 * ActionListView - Radix-styled list view for project actions
 *
 * Fetches ALL workflow surface nodes for the active project
 * and renders them in ActionRegistryTable with hierarchical tree.
 */

import { useWorkflowSurfaceNodes, useEmitEvent } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import { ActionRegistryTable } from '../composites/ActionRegistryTable';
import type { DerivedStatus } from '@autoart/shared';

export function ActionListView() {
    const { activeProjectId, setSelection, openOverlay, toggleComposerBar } = useUIStore();

    // Fetch all workflow nodes for the project (contextType='project' gets all descendants)
    const { data: nodes = [], isLoading } = useWorkflowSurfaceNodes(activeProjectId, 'project');
    const { mutate: emitEvent } = useEmitEvent();

    const handleRowSelect = (actionId: string) => {
        setSelection({ type: 'action', id: actionId });
    };

    const handleStatusChange = (actionId: string, status: DerivedStatus) => {
        if (!activeProjectId) return;
        // Emit status change event
        emitEvent({
            actionId,
            contextId: activeProjectId,
            contextType: 'project',
            type: 'STATUS_CHANGED',
            payload: { status },
        });
    };

    const handleAddAction = () => {
        // TODO: Replace with Command Palette (#87)
        toggleComposerBar();
    };

    const handleRowAction = (actionId: string, action: 'view' | 'edit' | 'history' | 'retract') => {
        switch (action) {
            case 'view':
                setSelection({ type: 'action', id: actionId });
                break;
            case 'edit':
                openOverlay('amend-action', { actionId });
                break;
            case 'retract':
                // Emit retraction event
                if (activeProjectId) {
                    emitEvent({
                        actionId,
                        contextId: activeProjectId,
                        contextType: 'project',
                        type: 'ACTION_RETRACTED',
                        payload: {},
                    });
                }
                break;
        }
    };

    if (!activeProjectId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
                <div className="text-center">
                    <p className="text-lg font-medium">Select a project to view actions</p>
                    <p className="text-sm mt-1">Choose from the Projects menu</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-indigo-500 rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-hidden p-4">
            <ActionRegistryTable
                nodes={nodes}
                onRowSelect={handleRowSelect}
                onStatusChange={handleStatusChange}
                onAddAction={handleAddAction}
                onRowAction={handleRowAction}
                className="h-full"
            />
        </div>
    );
}
