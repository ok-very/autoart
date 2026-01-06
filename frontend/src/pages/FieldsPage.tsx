/**
 * FieldsPage
 *
 * Registry view for Field Definitions and Field Instances (records using fields).
 *
 * Structure:
 * - Definitions tab: Field browser (Miller columns view)
 * - Instances tab: Records that use the selected field (conservative view)
 *
 * Note: Fields are emergent - instances are derived from records using the field.
 */

import { useState, useEffect } from 'react';
import { TableProperties, ClipboardList } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { ResizeHandle } from '../ui/atoms/ResizeHandle';
import { FieldsMillerColumnsView } from '../ui/composites/FieldsMillerColumnsView';
import { FieldDefinitionEditor } from '../ui/semantic/FieldDefinitionEditor';
import { RegistryPageHeader, type RegistryTab } from '../components/registry';
import { useUIStore, isFieldsViewMode } from '../stores/uiStore';
import type { FieldDescriptor } from '@autoart/shared';

export function FieldsPage() {
    const { viewMode, setViewMode, openDrawer } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(600);
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
        <div className="flex flex-col h-full bg-slate-50">
            <Header />

            {/* Page Header with tabs */}
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

            <div className="flex flex-1 overflow-hidden">
                {activeTab === 'instances' ? (
                    /* Instances View - Records using the selected field */
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ClipboardList size={32} className="text-slate-300" />
                            </div>
                            <p className="text-lg font-medium text-slate-600">Field Instances</p>
                            <p className="text-sm mt-1">Records using the selected field.</p>
                            <p className="text-xs mt-4 text-slate-400">
                                Select a field from the Definitions tab to see records that use it.
                            </p>
                        </div>
                    </div>
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
