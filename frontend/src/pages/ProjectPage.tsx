/**
 * ProjectPage - Page wrapper for project workflow view
 *
 * This is a PAGE that provides the layout shell (header, inspector, drawer)
 * around the ProjectView composite.
 *
 * Layout: Full-width workspace with optional inspector
 */

import { useCallback } from 'react';

import { useUIStore, useUIPanels } from '../stores/uiStore';
import { ResizeHandle } from '../ui/common/ResizeHandle';
import { ProjectView } from '../ui/composites/ProjectView';
import { SelectionInspector } from '../ui/composites/SelectionInspector';
import { BottomDrawer } from '../ui/drawer/BottomDrawer';
import { Header } from '../ui/layout/Header';

export function ProjectPage() {
    const { activeProjectId, inspectorWidth, setInspectorWidth } = useUIStore();
    const panels = useUIPanels();

    const handleInspectorResize = useCallback(
        (delta: number) => {
            setInspectorWidth(inspectorWidth + delta);
        },
        [inspectorWidth, setInspectorWidth]
    );

    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                {/* Main workspace - ProjectView composite */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <ProjectView projectId={activeProjectId} />
                    <BottomDrawer />
                </div>

                {/* Inspector Slot */}
                {panels.inspector && (
                    <>
                        <ResizeHandle direction="left" onResize={handleInspectorResize} />
                        <SelectionInspector />
                    </>
                )}
            </div>
        </div>
    );
}
