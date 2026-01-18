/**
 * RecordsPanel
 *
 * Docker-compatible version of RecordsPage.
 * Registry view for Record Definitions and Record Instances.
 */

import { Database } from 'lucide-react';
import { useCallback, useState, useEffect } from 'react';

import { useUIStore, isRecordsViewMode } from '../../stores/uiStore';
import { ResizeHandle } from '../common/ResizeHandle';
import { RecordView } from '../composites/RecordView';
import { RegistryPageHeader, DefinitionListSidebar, type RegistryTab } from '../registry';

export function RecordsPanel() {
    const { viewMode, setViewMode, openDrawer } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<RegistryTab>('instances');

    // Ensure we're using a valid RecordsViewMode when on this panel
    useEffect(() => {
        if (!isRecordsViewMode(viewMode)) {
            setViewMode('list');
        }
    }, [viewMode, setViewMode]);

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
        openDrawer('create-definition', { definitionKind: 'record' });
    };

    return (
        <div className="flex flex-1 overflow-hidden h-full bg-white">
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
                {/* Page Header with tabs */}
                <RegistryPageHeader
                    title="Records"
                    icon={Database}
                    showCreateButton={activeTab === 'definitions'}
                    onCreateClick={handleCreateDefinition}
                    createLabel="Create Record Definition"
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    showTabSwitch={true}
                />

                {/* Content based on tab */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'definitions' ? (
                        <div className="h-full flex items-center justify-center text-slate-400">
                            <div className="text-center">
                                <p className="text-lg font-medium text-slate-600">Record Definitions</p>
                                <p>Select a definition from the sidebar to view its schema.</p>
                            </div>
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
    );
}
