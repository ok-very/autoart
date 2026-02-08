/**
 * ActionsPanel
 *
 * Dockview-compatible panel for Action Definitions and Action Instances.
 * Uses unified RegistryFilterBar via DefinitionListSidebar.
 */

import { Zap } from 'lucide-react';
import { useCallback, useState } from 'react';

import { ResizeHandle, SegmentedControl } from '@autoart/ui';
import { useUIStore } from '../../stores/uiStore';
import { RegistryPageHeader, DefinitionListSidebar, type RegistryTab } from '../registry';
import { ActionInstancesView } from '../tables/ActionInstancesView';

// Tab data for Definitions/Instances toggle
const TAB_DATA = [
    { value: 'definitions', label: 'Definitions' },
    { value: 'instances', label: 'Instances' },
];

export function ActionsPanel() {
    const [sidebarWidth, setSidebarWidth] = useState(280);
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
        useUIStore.getState().openCommandPalette();
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-ws-panel-bg">
            {/* Header with title and Definitions/Instances toggle */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-ws-panel-border bg-ws-panel-bg">
                <RegistryPageHeader
                    title="Actions"
                    icon={Zap}
                    showCreateButton={activeTab === 'definitions'}
                    onCreateClick={handleCreateDefinition}
                    createLabel="Create Action Definition"
                    showTabSwitch={false}
                />
                <SegmentedControl
                    size="xs"
                    value={activeTab}
                    onChange={(value) => setActiveTab(value as RegistryTab)}
                    data={TAB_DATA}
                />
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Definition Sidebar - Actions only */}
                <DefinitionListSidebar
                    width={sidebarWidth}
                    selectedDefinitionId={selectedDefinitionId}
                    onSelectDefinition={handleSelectDefinition}
                    definitionKind="action_arrangement"
                />
                <ResizeHandle direction="right" onResize={handleSidebarResize} />

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'definitions' ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <p className="text-sm text-ws-text-secondary">
                                        Select a definition from the sidebar to view its schema.
                                    </p>
                                    <p className="text-xs mt-2 text-ws-text-secondary">
                                        Use the Composer panel to create new definitions.
                                    </p>
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
