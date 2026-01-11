/**
 * ImportPage - Page wrapper for Import Workbench
 *
 * Layout: ImportSidebar | Center View (swappable) | ImportInspector + BottomDrawer
 *
 * Center view swaps based on source type:
 * - file: ImportWorkbenchView
 * - monday: MondayPreviewView
 * - api: ApiPreviewView (placeholder)
 */

import { useCallback, useState, useMemo, useEffect } from 'react';
import { Header } from '../ui/layout/Header';
import { ImportSidebar } from '../surfaces/import/ImportSidebar';
import { ImportWorkbenchView } from '../surfaces/import/ImportWorkbenchView';
import { MondayPreviewView } from '../surfaces/import/MondayPreviewView';
import { ImportInspector } from '../surfaces/import/ImportInspector';
import { BottomDrawer } from '../ui/drawer/BottomDrawer';
import { ResizeHandle } from '../ui/common/ResizeHandle';
import { useUIStore } from '../stores/uiStore';
import type { ImportSession, ImportPlan } from '../api/hooks/imports';

// Source type lifted to page level for view swapping
export type ImportSourceType = 'file' | 'monday' | 'api';

export function ImportPage() {
    const { inspectorWidth, setInspectorWidth, openDrawer, activeDrawer } = useUIStore();
    const [sidebarWidth, setSidebarWidth] = useState(280);

    // Source type controls which center view is shown
    const [sourceType, setSourceType] = useState<ImportSourceType>('file');

    // Import session state (lifted to page level for cross-component access)
    const [session, setSession] = useState<ImportSession | null>(null);
    const [plan, setPlan] = useState<ImportPlan | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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
        setSession(newSession);
        setPlan(newPlan);
        setSelectedItemId(null);
    }, []);

    const handlePlanUpdated = useCallback((updatedPlan: ImportPlan) => {
        setPlan(updatedPlan);
    }, []);

    const handleReset = useCallback(() => {
        setSession(null);
        setPlan(null);
        setSelectedItemId(null);
    }, []);

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

    // Render center view based on source type
    const renderCenterView = () => {
        switch (sourceType) {
            case 'monday':
                return (
                    <MondayPreviewView
                        session={session}
                        plan={plan}
                        selectedItemId={selectedItemId}
                        onSelectItem={setSelectedItemId}
                        onReset={handleReset}
                    />
                );
            case 'file':
            default:
                return (
                    <ImportWorkbenchView
                        session={session}
                        plan={plan}
                        selectedItemId={selectedItemId}
                        onSelectItem={setSelectedItemId}
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
                <ImportInspector
                    width={inspectorWidth}
                    session={session}
                    plan={plan}
                    selectedItemId={selectedItemId}
                />
            </div>
        </div>
    );
}

export default ImportPage;
