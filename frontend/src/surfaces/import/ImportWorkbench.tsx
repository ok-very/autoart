/**
 * Import Workbench Surface
 *
 * Projection-driven import interface with:
 * - Session configuration panel
 * - Projection selector (hierarchy vs stage views)
 * - Import preview with selected projection
 * - Record inspector for inspecting planned actions
 * - Execution controls
 *
 * Replaces legacy IngestionView.tsx
 */

import { useState, useCallback } from 'react';
import { X, FileSpreadsheet } from 'lucide-react';
import { useActiveProjection, AVAILABLE_PROJECTIONS } from '../../stores/projectionStore';
import { ProjectionSelector } from './ProjectionSelector';
import { ImportPreview } from './ImportPreview';
import { RecordInspector } from './RecordInspector';
import { SessionConfigPanel } from './SessionConfigPanel';
import { ExecutionControls } from './ExecutionControls';
import type { ImportPlan, ImportSession } from '../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportWorkbenchProps {
    /** Callback when import completes successfully */
    onImportComplete?: () => void;
    /** Callback to close the workbench */
    onClose?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportWorkbench({ onImportComplete, onClose }: ImportWorkbenchProps) {
    // Session state
    const [session, setSession] = useState<ImportSession | null>(null);
    const [plan, setPlan] = useState<ImportPlan | null>(null);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    // Projection preference
    const [activeProjection, setActiveProjection] = useActiveProjection(
        'import-workbench',
        'hierarchy-projection'
    );

    // Handle session creation
    const handleSessionCreated = useCallback((newSession: ImportSession, newPlan: ImportPlan) => {
        setSession(newSession);
        setPlan(newPlan);
        setSelectedRecordId(null);
    }, []);

    // Handle record selection
    const handleRecordSelect = useCallback((recordId: string) => {
        setSelectedRecordId(recordId);
    }, []);

    // Handle execution start
    const handleExecuteStart = useCallback(() => {
        setIsExecuting(true);
    }, []);

    // Handle execution complete
    const handleExecuteComplete = useCallback((success: boolean) => {
        setIsExecuting(false);
        if (success) {
            onImportComplete?.();
        }
    }, [onImportComplete]);

    // Reset state
    const handleReset = useCallback(() => {
        setSession(null);
        setPlan(null);
        setSelectedRecordId(null);
    }, []);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="flex items-center justify-between h-14 px-6 bg-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    <h1 className="text-lg font-bold text-slate-800">Import Workbench</h1>
                    {session && (
                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            {session.parser_name}
                        </span>
                    )}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Session Config / Validation */}
                <div className="w-72 bg-white border-r border-slate-200 flex flex-col">
                    <SessionConfigPanel
                        session={session}
                        plan={plan}
                        onSessionCreated={handleSessionCreated}
                        onReset={handleReset}
                    />
                </div>

                {/* Center Panel: Preview */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Projection Selector */}
                    <ProjectionSelector
                        activeProjectionId={activeProjection}
                        availableProjections={AVAILABLE_PROJECTIONS}
                        onChange={setActiveProjection}
                        disabled={!plan}
                    />

                    {/* Preview */}
                    <div className="flex-1 overflow-auto">
                        <ImportPreview
                            plan={plan}
                            projectionId={activeProjection}
                            selectedRecordId={selectedRecordId}
                            onRecordSelect={handleRecordSelect}
                        />
                    </div>
                </div>

                {/* Right Panel: Record Inspector */}
                {selectedRecordId && plan && (
                    <div className="w-80 bg-white border-l border-slate-200 overflow-auto">
                        <RecordInspector
                            recordId={selectedRecordId}
                            plan={plan}
                            onClose={() => setSelectedRecordId(null)}
                        />
                    </div>
                )}
            </div>

            {/* Footer: Execution Controls */}
            <ExecutionControls
                session={session}
                plan={plan}
                isExecuting={isExecuting}
                onExecuteStart={handleExecuteStart}
                onExecuteComplete={handleExecuteComplete}
                onReset={handleReset}
            />
        </div>
    );
}

export default ImportWorkbench;
