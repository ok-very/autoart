/**
 * ImportPanel
 *
 * Docker-compatible version of ImportPage.
 * Layout: ImportSidebar | Center View (swappable)
 */

import { useCallback, useState, useMemo, useEffect } from 'react';

import type { ImportSession, ImportPlan } from '../../api/hooks/imports';
import { useUIStore } from '../../stores/uiStore';
import { ImportSidebar } from '../../surfaces/import/ImportSidebar';
import { ImportWorkbenchView } from '../../surfaces/import/ImportWorkbenchView';
import { MondayImportWizardView } from '../../surfaces/import/wizard/MondayImportWizardView';
// import { MondayPreviewView } from '../surfaces/import/MondayPreviewView'; // Replaced by Wizard
import { ResizeHandle } from '@autoart/ui';

// Source type lifted to panel level
export type ImportSourceType = 'file' | 'monday' | 'api';

export function ImportPanel() {
    const {
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
    // TODO: Verify if drawer works over Dockview. Yes it should (Drawers are z-index overlays).
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
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
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

                {/* NOTE: SelectionInspector removed from here. Use the global panel. */}
            </div>
        </div>
    );
}
