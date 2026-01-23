/**
 * FieldsPanel
 *
 * Docker-compatible version of FieldsPage.
 * Registry view for Field Definitions.
 */

import { TableProperties, ClipboardList } from 'lucide-react';
import { useState, useEffect } from 'react';

import type { FieldDescriptor } from '@autoart/shared';

import { useUIStore } from '../../stores/uiStore';
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
    const { setFieldsViewMode, openDrawer } = useUIStore();
    const collectionMode = useCollectionModeOptional();
    const [sidebarWidth, setSidebarWidth] = useState(300);
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
        openDrawer('add-field', {});
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Page Header with Definitions/Instances tabs on right */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
                <RegistryPageHeader
                    title="Fields"
                    icon={TableProperties}
                    showCreateButton={activeTab === 'definitions'}
                    onCreateClick={handleCreateField}
                    createLabel="Create Field"
                    showTabSwitch={false}
                />
                {/* Definitions/Instances toggle using bespoke SegmentedControl */}
                <SegmentedControl
                    size="xs"
                    value={activeTab}
                    onChange={(value) => setActiveTab(value as RegistryTab)}
                    data={TAB_DATA}
                />
            </div>

            <div className="flex flex-1 overflow-hidden">
                {activeTab === 'instances' ? (
                    /* Instances View - Miller Columns for field browsing + Instances table */
                    <>
                        {/* Left Sidebar - Miller Columns for field browsing */}
                        <div
                            style={{ width: sidebarWidth }}
                            className="flex flex-col border-r border-slate-200 bg-slate-100"
                        >
                            <FieldsMillerColumnsView
                                onSelectField={setSelectedField}
                            />
                        </div>

                        <ResizeHandle
                            direction="right"
                            onResize={(d) => setSidebarWidth(w => Math.max(300, Math.min(1200, w + d)))}
                        />

                        {/* Main Workspace - Field Instances */}
                        <div className="flex-1 bg-white overflow-hidden">
                            {selectedField ? (
                                <FieldInstancesReview
                                    key={selectedField.id}
                                    field={selectedField}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                        <ClipboardList size={32} className="text-slate-300" />
                                    </div>
                                    <p>Select a field to view its instances</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Definitions View - Miller columns browser */
                    <>
                        {/* Left Drawer / Sidebar - Miller Columns */}
                        <div
                            style={{ width: sidebarWidth }}
                            className="flex flex-col border-r border-slate-200 bg-slate-100"
                        >
                            <FieldsMillerColumnsView
                                onSelectField={setSelectedField}
                            />
                        </div>

                        <ResizeHandle
                            direction="right"
                            onResize={(d) => setSidebarWidth(w => Math.max(300, Math.min(1200, w + d)))}
                        />

                        {/* Main Workspace - Editor */}
                        <div className="flex-1 bg-white overflow-hidden">
                            {selectedField ? (
                                <FieldDefinitionEditor
                                    key={selectedField.id}
                                    field={selectedField}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                        <ClipboardList size={32} className="text-slate-300" />
                                    </div>
                                    <p>Select a field from the browser to edit its definition</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
