/**
 * ActionsPanel
 *
 * Docker-compatible version of ActionsPage.
 * Registry view for Action Definitions and Action Instances.
 */

import { Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
// import { useNavigate } from 'react-router-dom'; // No navigation

import { ResizeHandle } from '@autoart/ui';
import { RegistryPageHeader, DefinitionListSidebar, type RegistryTab } from '../registry';
import { ActionInstancesView } from '../tables/ActionInstancesView';

export function ActionsPanel() {
    // const navigate = useNavigate();
    // const { openDrawer } = useUIStore(); // We might use drawer or just open Composer panel

    // Note: ActionsPage handled inspector resizing globally via uiStore.
    // In Dockview, inspector resizing is handled by Dockview itself.
    // So we only handle local sidebar resizing.

    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<RegistryTab>('instances');

    const handleSidebarResize = useCallback(
        (delta: number) => {
            setSidebarWidth((w) => Math.max(200, Math.min(400, w + delta)));
        },
        []
    );

    const handleSelectDefinition = (id: string | null) => {
        setSelectedDefinitionId(id);
    };

    const handleCreateDefinition = () => {
        // Open Composer panel instead of navigating
        // useWorkspaceStore.getState().openPanel('composer') ? Or open drawer?
        // Current ActionsPage navigated to /composer.
        // We probably want to open the Composer panel if we migrate it, or use the drawer.
        // For now, let's assuming opening the Composer "drawer" (surface).
        // Actually, previous ActionsPage navigated to /composer.
        // I'll leave a TODO or open a drawer for now, or just notify 'Use Composer Panel'.
        console.log('TODO: Open Composer Panel');
        // If we make Composer a panel, we can open it.
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white">
            <div className="flex flex-1 overflow-hidden">
                {/* Definition Sidebar - Actions only */}
                <DefinitionListSidebar
                    width={sidebarWidth}
                    selectedDefinitionId={selectedDefinitionId}
                    onSelectDefinition={handleSelectDefinition}
                    definitionKind="action_recipe"
                />
                <ResizeHandle direction="right" onResize={handleSidebarResize} />

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Page Header with tabs */}
                    <RegistryPageHeader
                        title="Actions"
                        icon={Zap}
                        showCreateButton={activeTab === 'definitions'}
                        onCreateClick={handleCreateDefinition}
                        createLabel="Create Action Definition"
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        showTabSwitch={true}
                    />

                    {/* Content based on tab */}
                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'definitions' ? (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                <div className="text-center">
                                    <p className="text-lg font-medium text-slate-600">Action Definitions</p>
                                    <p>Select a definition from the sidebar to view its schema.</p>
                                    <p className="text-xs mt-2">Use the Composer panel to create new definitions.</p>
                                </div>
                            </div>
                        ) : (
                            <ActionInstancesView
                                definitionId={selectedDefinitionId}
                                className="h-full"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
