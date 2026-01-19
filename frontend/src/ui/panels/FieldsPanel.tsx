/**
 * FieldsPanel
 *
 * Docker-compatible version of FieldsPage.
 * Registry view for Field Definitions.
 */

import { TableProperties, ClipboardList } from 'lucide-react';
import { useState, useEffect } from 'react';

import type { FieldDescriptor } from '@autoart/shared';

import { useUIStore, isFieldsViewMode, FIELDS_VIEW_MODE_LABELS, type FieldsViewMode } from '../../stores/uiStore';
import { ResizeHandle, SegmentedControl } from '@autoart/ui';
import { FieldsMillerColumnsView } from '../composites/FieldsMillerColumnsView';
import { RegistryPageHeader, type RegistryTab } from '../registry';
import { FieldDefinitionEditor } from '../semantic/FieldDefinitionEditor';
import { FieldInstancesReview } from '../semantic/FieldInstancesReview';


export function FieldsPanel() {
    const { viewMode, setViewMode, openDrawer } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [selectedField, setSelectedField] = useState<FieldDescriptor | null>(null);
    const [activeTab, setActiveTab] = useState<RegistryTab>('definitions');

    // Ensure valid view mode on mount
    useEffect(() => {
        if (!isFieldsViewMode(viewMode)) {
            setViewMode('browse');
        }
    }, [viewMode, setViewMode]);

    const handleCreateField = () => {
        openDrawer('add-field', {});
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Page Header with tabs */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
                <RegistryPageHeader
                    title="Fields"
                    icon={TableProperties}
                    showCreateButton={activeTab === 'definitions'}
                    onCreateClick={handleCreateField}
                    createLabel="Create Field"
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    showTabSwitch={true}
                />
                {/* View Mode Switcher */}
                <SegmentedControl
                    size="xs"
                    value={isFieldsViewMode(viewMode) ? viewMode : 'browse'}
                    onChange={(value) => setViewMode(value as FieldsViewMode)}
                    data={Object.entries(FIELDS_VIEW_MODE_LABELS).map(([value, label]) => ({ value, label }))}
                />
            </div>

            <div className="flex flex-1 overflow-hidden">
                {activeTab === 'instances' ? (
                    /* Instances View - Records using the selected field */
                    selectedField ? (
                        <FieldInstancesReview
                            key={selectedField.id}
                            field={selectedField}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ClipboardList size={32} className="text-slate-300" />
                                </div>
                                <p className="text-lg font-medium text-slate-600">No Field Selected</p>
                                <p className="text-sm mt-1">Select a field from the Definitions tab first.</p>
                            </div>
                        </div>
                    )
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
