/**
 * FieldsPanel
 *
 * Dockview-compatible panel for Field Definitions and Field Instances.
 * Uses unified RegistryFilterBar for consistent search/sort across registry panels.
 */

import { TableProperties } from 'lucide-react';
import { useState, useEffect } from 'react';

import type { FieldDescriptor } from '@autoart/shared';

import { useUIStore } from '../../stores/uiStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useCollectionModeOptional } from '../../workflows/export/context/CollectionModeProvider';
import { ResizeHandle, SegmentedControl } from '@autoart/ui';
import { FieldsMillerColumnsView } from '../composites/FieldsMillerColumnsView';
import { RegistryPageHeader, type RegistryTab } from '../registry';
import { FieldDefinitionEditor } from '../semantic/FieldDefinitionEditor';
import { FieldInstancesReview } from '../semantic/FieldInstancesReview';

// Tab data for SegmentedControl
const TAB_DATA = [
    { value: 'definitions', label: 'Definitions' },
    { value: 'instances', label: 'Instances' },
];

export function FieldsPanel() {
    const setFieldsViewMode = useWorkspaceStore((s) => s.setFieldsViewMode);
    const { openOverlay } = useUIStore();
    const collectionMode = useCollectionModeOptional();
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [selectedField, setSelectedField] = useState<FieldDescriptor | null>(null);
    const [activeTab, setActiveTab] = useState<RegistryTab>('definitions');

    // Stop collecting when switching to instances tab (aggregate only makes sense for definitions)
    useEffect(() => {
        if (activeTab === 'instances' && collectionMode?.isCollecting) {
            collectionMode.stopCollecting();
            setFieldsViewMode('browse');
        }
    }, [activeTab, collectionMode, setFieldsViewMode]);

    const handleCreateField = () => {
        openOverlay('add-field', {});
    };

    return (
        <div className="flex flex-col h-full bg-ws-bg overflow-hidden">
            {/* Header with title and Definitions/Instances toggle */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-ws-panel-border bg-ws-panel-bg">
                <RegistryPageHeader
                    title="Fields"
                    icon={TableProperties}
                    showCreateButton={activeTab === 'definitions'}
                    onCreateClick={handleCreateField}
                    createLabel="Create Field"
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
                {/* Left Sidebar - Miller Columns for field browsing */}
                <div
                    style={{ width: sidebarWidth }}
                    className="flex flex-col border-r border-ws-panel-border bg-ws-bg shrink-0"
                >
                    <FieldsMillerColumnsView
                        onSelectField={setSelectedField}
                    />
                </div>

                <ResizeHandle
                    direction="right"
                    onResize={(d) => setSidebarWidth(w => Math.max(280, Math.min(1200, w + d)))}
                />

                {/* Main Content Area */}
                <div className="flex-1 bg-ws-panel-bg overflow-hidden">
                    {activeTab === 'instances' ? (
                        selectedField ? (
                            <FieldInstancesReview
                                key={selectedField.id}
                                field={selectedField}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-sm text-ws-text-secondary">
                                    Select a field to view its instances
                                </p>
                            </div>
                        )
                    ) : (
                        selectedField ? (
                            <FieldDefinitionEditor
                                key={selectedField.id}
                                field={selectedField}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-sm text-ws-text-secondary">
                                    Select a field from the browser to edit its definition
                                </p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
