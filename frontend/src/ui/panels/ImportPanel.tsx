/**
 * ImportPanel
 *
 * Docker-compatible version of ImportPage.
 * Layout: ImportSidebar | Center View (swappable)
 */

import { useCallback, useState, useEffect } from 'react';

import type { ImportSession, ImportPlan } from '../../api/hooks/imports';
import { useUIStore } from '../../stores/uiStore';
import { ImportSidebar } from '../../surfaces/import/ImportSidebar';
import { ImportWorkbenchView } from '../../surfaces/import/ImportWorkbenchView';
import { MondayImportWizardView } from '../../surfaces/import/wizard/MondayImportWizardView';
import { ResizeHandle } from '@autoart/ui';

// Source type lifted to panel level
export type ImportSourceType = 'file' | 'monday' | 'collector' | 'api';

export function ImportPanel() {
    const {
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

    const handleSidebarResize = useCallback(
        (delta: number) => {
            setSidebarWidth((w) => Math.max(200, Math.min(400, w + delta)));
        },
        []
    );

    const handleSessionCreated = useCallback((newSession: ImportSession, newPlan: ImportPlan) => {
        const isNewSession = newSession.id !== importSession?.id;
        setImportSession(newSession);
        setImportPlan(newPlan);
        // Only clear selection when starting a new session, not on plan updates
        if (isNewSession) {
            clearSelection();
        }
    }, [importSession?.id, setImportSession, setImportPlan, clearSelection]);

    const handleReset = useCallback(() => {
        setImportSession(null);
        setImportPlan(null);
        clearSelection();
    }, [setImportSession, setImportPlan, clearSelection]);

    // Auto-switch source type based on session connector type
    useEffect(() => {
        if (session) {
            // Connector sessions use parser_name like 'connector:monday'
            if (session.parser_name?.startsWith('connector:monday')) {
                setSourceType('monday');
            } else if (session.parser_name && !session.parser_name.startsWith('connector:')) {
                // File-based session
                setSourceType('file');
            } else if (session.parser_name?.startsWith('connector:')) {
                // Fallback for other connector types
                setSourceType('collector');
            }
        } else {
            // Reset to default when there is no active session
            setSourceType('file');
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
