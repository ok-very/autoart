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
import { ImportSidebar } from '../surfaces/import/ImportSidebar';
import { ImportWorkbenchView } from '../surfaces/import/ImportWorkbenchView';
import { MondayImportWizardView } from '../surfaces/import/wizard/MondayImportWizardView';
// import { MondayPreviewView } from '../surfaces/import/MondayPreviewView'; // Replaced by Wizard
import { ResizeHandle } from '@autoart/ui';
import { SelectionInspector } from '../ui/composites/SelectionInspector';
import { BottomDrawer } from '../ui/drawer/BottomDrawer';
import { Header } from '../ui/layout/Header';

// Source type lifted to page level for view swapping
export type ImportSourceType = 'file' | 'monday' | 'api';

export function ImportPage() {
    const {
        inspectorWidth,
        setInspectorWidth,
        openDrawer,
        activeDrawer,
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
        if (hasUnresolvedClassifications && session && plan && activeDrawer?.type !== 'classification') {
            openDrawer('classification', {
                sessionId: session.id,
                plan,
                onResolutionsSaved: handlePlanUpdated,
            });
        }
    }, [hasUnresolvedClassifications, session, plan, openDrawer, activeDrawer, handlePlanUpdated]);

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
                    <BottomDrawer />
                </div>

                {/* Right Inspector: Selected item details */}
                <ResizeHandle direction="left" onResize={handleInspectorResize} />
                <SelectionInspector />
            </div>
        </div>
    );
}

export default ImportPage;
