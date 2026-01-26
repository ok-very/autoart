/**
 * ImportPage - Page wrapper for Import Workbench
 *
 * Layout: ImportSidebar | Center View (swappable) | SelectionInspector + BottomDrawer
 *
 * Center view swaps based on source type:
 * - file: ImportWorkbenchView
 * - monday: MondayPreviewView
 * - api: ApiPreviewView (placeholder)
 */

import { useCallback, useState, useMemo, useEffect } from 'react';

import type { ImportSession, ImportPlan } from '../api/hooks/imports';
import { useUIStore } from '../stores/uiStore';
import { ImportSidebar } from '../workflows/import/panels/ImportSidebar';
import { ImportWorkbenchView } from '../workflows/import/views/ImportWorkbenchView';
import { MondayImportWizardView } from '../workflows/import/wizard/MondayImportWizardView';
// import { MondayPreviewView } from '../workflows/import/views/MondayPreviewView'; // Replaced by Wizard
import { ResizeHandle } from '@autoart/ui';
import { SelectionInspector } from '../ui/composites/SelectionInspector';
import { Header } from '../ui/layout/Header';

// Source type lifted to page level for view swapping
export type ImportSourceType = 'file' | 'monday' | 'collector' | 'api';

export function ImportPage() {
    const {
        inspectorWidth,
        setInspectorWidth,
        openOverlay,
        activeOverlay,
        importSession,
        importPlan,
        setImportSession,
        setImportPlan,
        selectImportItem,
        clearSelection,
    } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(280);

    // Source type controls which center view is shown
    const [sourceType, setSourceType] = useState<ImportSourceType>('file');

    // Use uiStore for session/plan (aliased for compatibility with child components)
    const session = importSession;
    const plan = importPlan;

    // Check if there are unresolved classifications
    const hasUnresolvedClassifications = useMemo(() => {
        if (!plan?.classifications) return false;
        return plan.classifications.some(
            (c) => !c.resolution && (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED')
        );
    }, [plan]);

    const handleSidebarResize = useCallback(
        (delta: number) => {
            setSidebarWidth((w) => Math.max(200, Math.min(400, w + delta)));
        },
        []
    );

    const handleInspectorResize = useCallback(
        (delta: number) => {
            setInspectorWidth(inspectorWidth + delta);
        },
        [inspectorWidth, setInspectorWidth]
    );

    const handleSessionCreated = useCallback((newSession: ImportSession, newPlan: ImportPlan) => {
        setImportSession(newSession);
        setImportPlan(newPlan);
        clearSelection();
    }, [setImportSession, setImportPlan, clearSelection]);

    const handlePlanUpdated = useCallback((updatedPlan: ImportPlan) => {
        setImportPlan(updatedPlan);
    }, [setImportPlan]);

    const handleReset = useCallback(() => {
        setImportSession(null);
        setImportPlan(null);
        clearSelection();
    }, [setImportSession, setImportPlan, clearSelection]);

    // Open classification drawer when unresolved items exist
    useEffect(() => {
        if (hasUnresolvedClassifications && session && plan && activeOverlay?.type !== 'classification') {
            openOverlay('classification', {
                sessionId: session.id,
                plan,
                onResolutionsSaved: handlePlanUpdated,
            });
        }
    }, [hasUnresolvedClassifications, session, plan, openOverlay, activeOverlay, handlePlanUpdated]);

    // Auto-switch source type based on session connector type
    useEffect(() => {
        if (session) {
            // Connector sessions use parser_name like 'connector:monday'
            if (session.parser_name?.startsWith('connector:monday')) {
                setSourceType('monday');
            } else if (session.parser_name && !session.parser_name.startsWith('connector:')) {
                // File-based session
                setSourceType('file');
            }
        }
    }, [session]);

    // Render center view based on source type
    const renderCenterView = () => {
        switch (sourceType) {
            case 'monday':
                return (
                    <MondayImportWizardView
                        session={session}
                        plan={plan}
                        onSelectItem={selectImportItem}
                        onReset={handleReset}
                        onSessionCreated={handleSessionCreated}
                    />
                );
            case 'file':
            default:
                return (
                    <ImportWorkbenchView
                        session={session}
                        plan={plan}
                        onSelectItem={selectImportItem}
                        onReset={handleReset}
                    />
                );
        }
    };

    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Source selection & configuration */}
                <ImportSidebar
                    width={sidebarWidth}
                    sourceType={sourceType}
                    onSourceChange={setSourceType}
                    session={session}
                    plan={plan}
                    onSessionCreated={handleSessionCreated}
                    onReset={handleReset}
                />
                <ResizeHandle direction="right" onResize={handleSidebarResize} />

                {/* Center: Preview workspace (swappable based on source) */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {renderCenterView()}
                </div>

                {/* Right Inspector: Selected item details */}
                <ResizeHandle direction="left" onResize={handleInspectorResize} />
                <SelectionInspector />
            </div>
        </div>
    );
}

export default ImportPage;
