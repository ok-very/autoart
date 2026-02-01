/**
 * ImportWorkbenchView
 *
 * Center workspace content for Import Workbench.
 * Shows preview of imported data with projection selector.
 *
 * This is the WORKSPACE slot content - receives state from ImportPage.
 */

import { FileSpreadsheet, Columns, Layers, AlertCircle } from 'lucide-react';
import { useState, useMemo } from 'react';

import { ExecutionControls } from '../panels/ExecutionControls';
import { HierarchyPreview } from '../components/HierarchyPreview';
import { StagePreview } from '../components/StagePreview';
import type { ImportSession, ImportPlan } from '../../../api/hooks/imports';
import { useUIStore } from '../../../stores/uiStore';
import { Text, Stack, Badge } from '@autoart/ui';

// ============================================================================
// TYPES
// ============================================================================

type PreviewMode = 'hierarchy' | 'stage';

interface ImportWorkbenchViewProps {
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (itemId: string | null) => void;
    onReset: () => void;
}

// ============================================================================
// CLASSIFICATION BADGE
// ============================================================================

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

export function ImportWorkbenchView({
    session,
    plan,
    onSelectItem,
    onReset,
}: ImportWorkbenchViewProps) {
    const [previewMode, setPreviewMode] = useState<PreviewMode>('hierarchy');
    const [isExecuting, setIsExecuting] = useState(false);

    // Get selected item ID from uiStore
    const { selection } = useUIStore();
    const selectedItemId = selection?.type === 'import_item' ? selection.id : null;

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

    // Empty state
    if (!session || !plan) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
                <Stack gap="md" className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
                        <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                    </div>
                    <Text size="lg" weight="medium" color="dimmed">
                        No import session active
                    </Text>
                    <Text size="sm" color="muted">
                        Upload a file or connect to Monday.com to start importing data.
                    </Text>
                </Stack>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Preview Mode Tabs */}
            <div className="border-b border-slate-200 bg-white px-4">
                <div className="flex items-center gap-1 h-10">
                    <button
                        onClick={() => setPreviewMode('hierarchy')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${previewMode === 'hierarchy'
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        <Columns className="w-4 h-4" />
                        Hierarchy
                    </button>
                    <button
                        onClick={() => setPreviewMode('stage')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${previewMode === 'stage'
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        <Layers className="w-4 h-4" />
                        Stages
                    </button>
                    {/* Classification Summary - unresolved indicator */}
                    {hasUnresolvedClassifications && (
                        <Badge size="sm" className="bg-amber-100 text-amber-700 ml-2">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Needs Review
                        </Badge>
                    )}

                    {/* Classification Counts */}
                    <div className="ml-auto flex items-center gap-2">
                        {Object.entries(outcomeCounts).map(([outcome, count]) => {
                            const colors = OUTCOME_COLORS[outcome] || { bg: 'bg-slate-100', text: 'text-slate-600' };
                            return (
                                <Badge key={outcome} size="sm" className={`${colors.bg} ${colors.text}`}>
                                    {outcome.replace(/_/g, ' ')}: {count}
                                </Badge>
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
                        onSelect={onSelectItem}
                    />
                )}
                {previewMode === 'stage' && (
                    <StagePreview
                        plan={plan}
                        selectedRecordId={selectedItemId}
                        onSelect={onSelectItem}
                    />
                )}
            </div>

            {/* Execution Controls (bottom bar) */}
            {session && plan && (
                <ExecutionControls
                    session={session}
                    plan={plan}
                    isExecuting={isExecuting}
                    onExecuteStart={() => setIsExecuting(true)}
                    onExecuteComplete={(success) => {
                        setIsExecuting(false);
                        if (success) {
                            // Could trigger navigation or callback
                        }
                    }}
                    onReset={onReset}
                />
            )}
        </div>
    );
}

export default ImportWorkbenchView;
