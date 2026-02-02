/**
 * ImportWorkbenchContent
 *
 * Center workspace content for Import Workbench.
 * Shows preview of imported data with projection/view selector tabs.
 * Classification review is accessed via bottom drawer.
 *
 * This is the WORKSPACE slot content - preview focused.
 */

import { clsx } from 'clsx';
import { FileSpreadsheet, Columns, Layers, Tag, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';

import { ExecutionControls } from '../panels/ExecutionControls';
import { HierarchyPreview } from '../components/HierarchyPreview';
import { StagePreview } from '../components/StagePreview';
import { useImportWorkbenchStore } from '../../../stores/importWorkbenchStore';
import { useUIStore } from '../../../stores/uiStore';

// ============================================================================
// TYPES
// ============================================================================

type PreviewMode = 'hierarchy' | 'stage';

const OUTCOME_COLORS: Record<string, { bg: string; text: string }> = {
    FACT_EMITTED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    DERIVED_STATE: { bg: 'bg-blue-100', text: 'text-blue-700' },
    INTERNAL_WORK: { bg: 'bg-slate-100', text: 'text-slate-600' },
    EXTERNAL_WORK: { bg: 'bg-purple-100', text: 'text-purple-700' },
    AMBIGUOUS: { bg: 'bg-amber-100', text: 'text-amber-700' },
    UNCLASSIFIED: { bg: 'bg-red-100', text: 'text-red-700' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportWorkbenchContent() {
    const [previewMode, setPreviewMode] = useState<PreviewMode>('hierarchy');
    const { session, plan, selectedItemId, setSelectedItemId, reset } = useImportWorkbenchStore();
    const { openOverlay, inspectRecord } = useUIStore();

    // Count classifications by outcome
    const outcomeCounts = useMemo(() => {
        if (!plan?.classifications) return {};
        return plan.classifications.reduce((acc, c) => {
            acc[c.outcome] = (acc[c.outcome] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [plan]);

    // Check for unresolved classifications
    const unresolvedCount = useMemo(() => {
        if (!plan?.classifications) return 0;
        return plan.classifications.filter(
            (c) => !c.resolution && (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED')
        ).length;
    }, [plan]);

    // Handle item selection - also update inspector
    const handleSelectItem = (itemId: string | null) => {
        setSelectedItemId(itemId);
        if (itemId) {
            inspectRecord(itemId);
        }
    };

    // Open classification panel in bottom drawer
    const handleOpenClassifications = () => {
        if (session) {
            openOverlay('classification', { sessionId: session.id });
        }
    };

    // Empty state
    if (!session || !plan) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 mb-2">
                        No import session active
                    </p>
                    <p className="text-sm text-slate-400">
                        Upload a file or connect to Monday.com to start importing data.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Preview Mode Tabs */}
            <div className="border-b border-slate-200 bg-white px-4">
                <div className="flex items-center gap-1 h-12">
                    <button
                        onClick={() => setPreviewMode('hierarchy')}
                        className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                            previewMode === 'hierarchy'
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                        )}
                    >
                        <Columns className="w-4 h-4" />
                        Hierarchy
                    </button>
                    <button
                        onClick={() => setPreviewMode('stage')}
                        className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                            previewMode === 'stage'
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                        )}
                    >
                        <Layers className="w-4 h-4" />
                        Stages
                    </button>

                    {/* Classification Review Button */}
                    <button
                        onClick={handleOpenClassifications}
                        className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                            unresolvedCount > 0
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                : 'text-slate-600 hover:bg-slate-100'
                        )}
                    >
                        <Tag className="w-4 h-4" />
                        Classifications
                        {unresolvedCount > 0 && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold bg-amber-500 text-white rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                {unresolvedCount}
                            </span>
                        )}
                    </button>

                    {/* Classification Summary Badges */}
                    <div className="ml-auto flex items-center gap-2">
                        {Object.entries(outcomeCounts).map(([outcome, count]) => {
                            const colors = OUTCOME_COLORS[outcome] || { bg: 'bg-slate-100', text: 'text-slate-600' };
                            return (
                                <span
                                    key={outcome}
                                    className={clsx('px-2 py-0.5 text-xs font-medium rounded', colors.bg, colors.text)}
                                >
                                    {outcome.replace(/_/g, ' ')}: {count}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto">
                {previewMode === 'hierarchy' && (
                    <HierarchyPreview
                        plan={plan}
                        selectedRecordId={selectedItemId}
                        onSelect={handleSelectItem}
                    />
                )}
                {previewMode === 'stage' && (
                    <StagePreview
                        plan={plan}
                        selectedRecordId={selectedItemId}
                        onSelect={handleSelectItem}
                    />
                )}
            </div>

            {/* Execution Controls (bottom bar) */}
            <ExecutionControls
                session={session}
                plan={plan}
                isExecuting={false}
                onExecuteStart={() => {}}
                onExecuteComplete={(success) => {
                    if (success) {
                        // TODO: Navigate to records or show success
                    }
                }}
                onReset={reset}
            />
        </div>
    );
}

export default ImportWorkbenchContent;
