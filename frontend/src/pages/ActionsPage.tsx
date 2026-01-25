/**
 * ActionsPage
 *
 * Registry view for Action Definitions and Action Instances.
 *
 * Structure:
 * - Definitions tab: Action Definitions (definition_kind='action_recipe')
 * - Instances tab: Action instances filtered by selected definition
 *
 * Note: + button opens Composer to create new action recipe.
 */

import { Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useUIStore } from '../stores/uiStore';
import { ResizeHandle } from '@autoart/ui';
import { SelectionInspector } from '../ui/composites/SelectionInspector';
import { Header } from '../ui/layout/Header';
import { RegistryPageHeader, DefinitionListSidebar, type RegistryTab } from '../ui/registry';
import { ActionInstancesView } from '../ui/tables/ActionInstancesView';

export function ActionsPage() {
    const navigate = useNavigate();
    const { inspectorWidth, setInspectorWidth } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<RegistryTab>('instances');

    const handleSidebarResize = useCallback(
        (delta: number) => {
            setSidebarWidth((w) => Math.max(200, Math.min(400, w + delta)));
        },
        []
    );

    const handleInspectorResize = useCallback(
        (delta: number) => {
            setInspectorWidth(inspectorWidth + delta);
        },
        [inspectorWidth, setInspectorWidth]
    );

    const handleSelectDefinition = (id: string | null) => {
        setSelectedDefinitionId(id);
    };

    const handleCreateDefinition = () => {
        // Navigate to Composer to create a new action recipe
        navigate('/composer');
    };

    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex flex-1 flex-col overflow-hidden">
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
                                        <p className="text-xs mt-2">Use the + button to create a new action definition in Composer.</p>
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

                    <ResizeHandle direction="left" onResize={handleInspectorResize} />

                    {/* Right Inspector */}
                    <SelectionInspector />
                </div>
            </div>
        </div>
    );
}
