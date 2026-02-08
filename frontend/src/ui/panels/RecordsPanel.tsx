/**
 * RecordsPanel
 *
 * Dockview-compatible panel for Record Definitions and Record Instances.
 * Uses unified RegistryFilterBar via DefinitionListSidebar.
 */

import { Database } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useUIStore } from '../../stores/uiStore';
import { ResizeHandle, SegmentedControl } from '@autoart/ui';
import { RecordView } from '../composites/RecordView';
import { RegistryPageHeader, DefinitionListSidebar, type RegistryTab } from '../registry';

// Tab data for Definitions/Instances toggle
const TAB_DATA = [
    { value: 'definitions', label: 'Definitions' },
    { value: 'instances', label: 'Instances' },
];

export function RecordsPanel() {
    const { openOverlay } = useUIStore();
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
        openOverlay('create-definition', { definitionKind: 'record' });
    };

    return (
        <div className="flex flex-col h-full bg-ws-panel-bg overflow-hidden">
            {/* Header with title and Definitions/Instances toggle */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-ws-panel-border bg-ws-panel-bg">
                <RegistryPageHeader
                    title="Records"
                    icon={Database}
                    showCreateButton={activeTab === 'definitions'}
                    onCreateClick={handleCreateDefinition}
                    createLabel="Create Record Definition"
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
                {/* Definition Sidebar - Records only */}
                <DefinitionListSidebar
                    width={sidebarWidth}
                    selectedDefinitionId={selectedDefinitionId}
                    onSelectDefinition={handleSelectDefinition}
                    definitionKind="record"
                />
                <ResizeHandle direction="right" onResize={handleSidebarResize} />

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'definitions' ? (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-sm text-ws-text-secondary">
                                    Select a definition from the sidebar to view its schema.
                                </p>
                            </div>
                        ) : (
                            <RecordView
                                definitionId={selectedDefinitionId}
                                onDefinitionChange={(id) => setSelectedDefinitionId(id)}
                                className="h-full"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
