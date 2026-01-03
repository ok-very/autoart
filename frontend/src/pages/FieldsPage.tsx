import { useState, useEffect } from 'react';
import { TableProperties, ClipboardList } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { ResizeHandle } from '../ui/atoms/ResizeHandle';
import { FieldsMillerColumnsView } from '../ui/composites/FieldsMillerColumnsView';
import { FieldDefinitionEditor } from '../ui/semantic/FieldDefinitionEditor';
import { useUIStore, isFieldsViewMode } from '../stores/uiStore';
import type { FieldDescriptor } from '@autoart/shared';

export function FieldsPage() {
    const { viewMode, setViewMode } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(600);
    const [selectedField, setSelectedField] = useState<FieldDescriptor | null>(null);

    // Ensure valid view mode on mount
    useEffect(() => {
        if (!isFieldsViewMode(viewMode)) {
            setViewMode('browse');
        }
    }, [viewMode, setViewMode]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header />
            {/* Page Title Header */}
            <div className="h-12 bg-white border-b border-slate-200 flex items-center px-6 shrink-0">
                <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <TableProperties size={20} className="text-slate-500" />
                    Fields Explorer
                </h1>
                <div className="ml-auto text-xs text-slate-400">
                    Mode: {viewMode}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {viewMode === 'aggregate' ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <p className="text-lg font-medium text-slate-600">Aggregate View</p>
                            <p>Field usage statistics and global analysis coming soon.</p>
                        </div>
                    </div>
                ) : (
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
