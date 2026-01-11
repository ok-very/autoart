/**
 * ImportWorkbenchContent
 *
 * Center workspace content for Import Workbench.
 * Shows preview of imported data with projection/view selector tabs.
 *
 * This is the WORKSPACE slot content.
 */

import { useState, useMemo } from 'react';
import { FileSpreadsheet, Columns, Layers, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import { HierarchyPreview } from './HierarchyPreview';
import { StagePreview } from './StagePreview';
import { ClassificationPanel } from './ClassificationPanel';
import { ExecutionControls } from './ExecutionControls';
import { useImportWorkbenchStore } from '../../stores/importWorkbenchStore';
import { useUIStore } from '../../stores/uiStore';

// ============================================================================
// TYPES
// ============================================================================

type PreviewMode = 'hierarchy' | 'stage' | 'classification';

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
    const { session, plan, selectedItemId, setSelectedItemId, setPlan, reset } = useImportWorkbenchStore();
    const { inspectRecord } = useUIStore();

    // Count classifications by outcome
    const outcomeCounts = useMemo(() => {
        if (!plan?.classifications) return {};
        return plan.classifications.reduce((acc, c) => {
            acc[c.outcome] = (acc[c.outcome] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [plan]);

    // Check for unresolved classifications
    const hasUnresolvedClassifications = useMemo(() => {
        if (!plan?.classifications) return false;
        return plan.classifications.some(
            (c) => !c.resolution && (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED')
        );
    }, [plan]);

    // Handle item selection - also update inspector
    const handleSelectItem = (itemId: string | null) => {
        setSelectedItemId(itemId);
        if (itemId) {
            // Find the item and set selection in UI store for inspector
            const item = plan?.items?.find((i) => i.tempId === itemId);
            if (item) {
                inspectRecord(itemId); // This will update SelectionInspector
            }
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
                    <p className="text-lg font-medium text-slate-500 mb-2">
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
                    <button
                        onClick={() => setPreviewMode('classification')}
                        className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                            previewMode === 'classification'
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                        )}
                    >
                        <Tag className="w-4 h-4" />
                        Classifications
                        {hasUnresolvedClassifications && (
                            <span className="w-2 h-2 bg-amber-500 rounded-full" />
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
                {previewMode === 'classification' && (
                    <ClassificationPanel
                        sessionId={session.id}
                        plan={plan}
                        onResolutionsSaved={setPlan}
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
