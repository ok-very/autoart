/**
 * RecordPage - Page wrapper for records workspace
 *
 * This is a PAGE that provides the layout shell (header, sidebar, inspector, drawer)
 * around the RecordView composite.
 *
 * Layout: Left sidebar (definition types) | Main table (records) | Right inspector
 */

import { useCallback, useState } from 'react';
import { Header } from '../ui/layout/Header';
import { RecordTypeSidebar } from '../ui/records/RecordTypeSidebar';
import { SelectionInspector } from '../ui/composites/SelectionInspector';
import { RecordView } from '../ui/composites/RecordView';
import { BottomDrawer } from '../ui/drawer/BottomDrawer';
import { ResizeHandle } from '../ui/common/ResizeHandle';
import { useUIStore } from '../stores/uiStore';

export function RecordPage() {
    const { inspectorWidth, setInspectorWidth } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(240);
    const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);

    const handleSidebarResize = useCallback(
        (delta: number) => {
            setSidebarWidth((w) => Math.max(180, Math.min(400, w + delta)));
        },
        []
    );

    const handleInspectorResize = useCallback(
        (delta: number) => {
            setInspectorWidth(inspectorWidth + delta);
        },
        [inspectorWidth, setInspectorWidth]
    );

    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex flex-1 overflow-hidden">
                    {/* Record Type Sidebar */}
                    <RecordTypeSidebar
                        width={sidebarWidth}
                        selectedDefinitionId={selectedDefinitionId}
                        onSelectDefinition={setSelectedDefinitionId}
                    />
                    <ResizeHandle direction="right" onResize={handleSidebarResize} />

                    {/* Main Table Area - RecordView composite */}
                    <div className="flex-1 overflow-hidden">
                        <RecordView
                            definitionId={selectedDefinitionId}
                            onDefinitionChange={setSelectedDefinitionId}
                        />
                    </div>

                    <ResizeHandle direction="left" onResize={handleInspectorResize} />

                    {/* Right Inspector */}
                    <SelectionInspector />
                </div>
                <BottomDrawer />
            </div>
        </div>
    );
}
