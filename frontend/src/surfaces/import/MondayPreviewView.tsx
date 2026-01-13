/**
 * MondayPreviewView
 *
 * Center view for Monday.com board data preview.
 * Shows the imported board hierarchy, items, and subitems.
 *
 * This is the CENTER VIEW when source type is 'monday'.
 */

import { Columns, Layers, Calendar } from 'lucide-react';
import { useState, useMemo } from 'react';

import { ExecutionControls } from './ExecutionControls';
import { HierarchyPreview } from './HierarchyPreview';
import { StagePreview } from './StagePreview';
import type { ImportSession, ImportPlan } from '../../api/hooks/imports';
import { useUIStore } from '../../stores/uiStore';
import { Text, Stack, Badge } from '../../ui/atoms';

// ============================================================================
// TYPES
// ============================================================================

type PreviewMode = 'hierarchy' | 'stage';

interface MondayPreviewViewProps {
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (itemId: string | null) => void;
    onReset: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MondayPreviewView({
    session,
    plan,
    onSelectItem,
    onReset,
}: MondayPreviewViewProps) {
    const [previewMode, setPreviewMode] = useState<PreviewMode>('hierarchy');

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

    // No session yet - show empty state (board selection happens in sidebar)
    if (!session || !plan) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
                <Stack gap="md" className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                        <Calendar className="w-8 h-8 text-amber-600" />
                    </div>
                    <Text size="lg" weight="medium" color="dimmed">
                        Select a Board
                    </Text>
                    <Text size="sm" color="muted">
                        Choose a board from the sidebar to preview its data.
                    </Text>
                </Stack>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Board Header */}
            <div className="px-4 py-3 bg-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <Text size="xs" color="muted" className="uppercase tracking-wide">
                            Monday.com Board
                        </Text>
                        <Text size="lg" weight="semibold">
                            {session.parser_name}
                        </Text>
                    </div>
                </div>
            </div>

            {/* Preview Mode Tabs */}
            <div className="border-b border-slate-200 bg-white px-4">
                <div className="flex items-center gap-1 h-12">
                    <button
                        onClick={() => setPreviewMode('hierarchy')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${previewMode === 'hierarchy'
                                ? 'bg-amber-100 text-amber-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        <Columns className="w-4 h-4" />
                        Hierarchy
                    </button>
                    <button
                        onClick={() => setPreviewMode('stage')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${previewMode === 'stage'
                                ? 'bg-amber-100 text-amber-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        <Layers className="w-4 h-4" />
                        Stages
                    </button>
                    {/* Classification Summary - unresolved indicator */}
                    {hasUnresolvedClassifications && (
                        <Badge size="sm" className="bg-amber-100 text-amber-700 ml-2">
                            Needs Review
                        </Badge>
                    )}

                    {/* Classification Counts */}
                    <div className="ml-auto flex items-center gap-2">
                        {Object.entries(outcomeCounts).map(([outcome, count]) => (
                            <span
                                key={outcome}
                                className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded"
                            >
                                {outcome.replace(/_/g, ' ')}: {count}
                            </span>
                        ))}
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
                    isExecuting={false}
                    onExecuteStart={() => { }}
                    onExecuteComplete={(success) => {
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

export default MondayPreviewView;
