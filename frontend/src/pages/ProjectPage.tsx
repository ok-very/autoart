/**
 * ProjectPage - Page wrapper for project workflow view
 *
 * This is a PAGE that provides the layout shell (header, inspector, drawer)
 * around the ProjectView composite.
 *
 * Layout: Full-width workspace with optional inspector
 *
 * Phase 1 Narrative Canvas:
 * - Includes UnifiedComposerBar at bottom for context-aware action declaration
 */

import { useCallback } from 'react';

import { useUIStore, useUIPanels } from '../stores/uiStore';
import { ResizeHandle } from '@autoart/ui';
import { ProjectView } from '../ui/composites/ProjectView';
import { SelectionInspector } from '../ui/composites/SelectionInspector';
import { Header } from '../ui/layout/Header';
import { UnifiedComposerBar } from '../ui/composer';

export function ProjectPage() {
    const { activeProjectId, inspectorWidth, setInspectorWidth, composerBarVisible } = useUIStore();
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
                    {/* Add bottom padding when composer bar is visible to prevent overlap */}
                    <div className={composerBarVisible ? 'pb-16' : ''}>
                        <ProjectView projectId={activeProjectId} />
                    </div>
                </div>

                {/* Inspector Slot */}
                {panels.inspector && (
                    <>
                        <ResizeHandle direction="left" onResize={handleInspectorResize} />
                        <SelectionInspector />
                    </>
                )}
            </div>

            {/* Unified Composer Bar - Fixed at bottom */}
            <UnifiedComposerBar visible={composerBarVisible} />
        </div>
    );
}
