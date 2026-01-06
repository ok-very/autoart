/**
 * Classification Panel
 *
 * Displays unresolved classifications (AMBIGUOUS/UNCLASSIFIED) and allows
 * the user to resolve them before import execution.
 */

import { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, HelpCircle, Check, X, ChevronDown, Save, Loader2 } from 'lucide-react';
import { useSaveResolutions } from '../../api/hooks/imports';
import type { ImportPlan, Resolution } from '../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

interface ClassificationPanelProps {
    sessionId: string | null;
    plan: ImportPlan | null;
    onResolutionsSaved: (updatedPlan: ImportPlan) => void;
}

interface PendingResolution {
    itemTempId: string;
    outcome: 'FACT_EMITTED' | 'DERIVED_STATE' | 'INTERNAL_WORK' | 'SKIP' | null;
    factKind?: string;
}

// ============================================================================
// OUTCOME OPTIONS
// ============================================================================

const OUTCOME_OPTIONS = [
    { value: 'FACT_EMITTED', label: 'Emit as Fact', icon: Check, color: 'text-green-600' },
    { value: 'DERIVED_STATE', label: 'Derived State', icon: Check, color: 'text-blue-600' },
    { value: 'INTERNAL_WORK', label: 'Internal Work', icon: HelpCircle, color: 'text-slate-500' },
    { value: 'SKIP', label: 'Skip', icon: X, color: 'text-red-500' },
] as const;

// ============================================================================
// HELPERS
// ============================================================================

function getConfidenceColor(confidence: string): string {
    switch (confidence) {
        case 'high': return 'bg-green-100 text-green-700';
        case 'medium': return 'bg-amber-100 text-amber-700';
        case 'low': return 'bg-red-100 text-red-700';
        default: return 'bg-slate-100 text-slate-600';
    }
}

function getOutcomeIcon(outcome: string) {
    switch (outcome) {
        case 'AMBIGUOUS': return AlertTriangle;
        case 'UNCLASSIFIED': return HelpCircle;
        default: return HelpCircle;
    }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ClassificationPanel({
    sessionId,
    plan,
    onResolutionsSaved,
}: ClassificationPanelProps) {
    const [pendingResolutions, setPendingResolutions] = useState<Map<string, PendingResolution>>(
        new Map()
    );
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    const saveResolutionsMutation = useSaveResolutions();

    // Get unresolved classifications
    const unresolvedItems = useMemo(() => {
        if (!plan?.classifications) return [];
        return plan.classifications.filter(
            (c) => !c.resolution && (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED')
        );
    }, [plan]);

    // Get item title by tempId
    const getItemTitle = useCallback((itemTempId: string) => {
        const item = plan?.items.find((i) => i.tempId === itemTempId);
        return item?.title ?? itemTempId;
    }, [plan]);

    // Handle outcome selection
    const handleOutcomeSelect = useCallback((itemTempId: string, outcome: PendingResolution['outcome']) => {
        setPendingResolutions((prev) => {
            const next = new Map(prev);
            const existing = next.get(itemTempId) ?? { itemTempId, outcome: null };
            next.set(itemTempId, { ...existing, outcome });
            return next;
        });
    }, []);

    // Handle fact kind selection
    const handleFactKindSelect = useCallback((itemTempId: string, factKind: string) => {
        setPendingResolutions((prev) => {
            const next = new Map(prev);
            const existing = next.get(itemTempId) ?? { itemTempId, outcome: 'FACT_EMITTED' };
            next.set(itemTempId, { ...existing, factKind });
            return next;
        });
    }, []);

    // Count resolved items
    const resolvedCount = useMemo(() => {
        return Array.from(pendingResolutions.values()).filter((r) => r.outcome !== null).length;
    }, [pendingResolutions]);

    // Check if all items are resolved
    const allResolved = resolvedCount === unresolvedItems.length && unresolvedItems.length > 0;

    // Handle save
    const handleSave = useCallback(async () => {
        if (!sessionId || !allResolved) return;

        const resolutions: Resolution[] = Array.from(pendingResolutions.values())
            .filter((r) => r.outcome !== null)
            .map((r) => ({
                itemTempId: r.itemTempId,
                resolvedOutcome: r.outcome!,
                resolvedFactKind: r.factKind,
            }));

        try {
            const updatedPlan = await saveResolutionsMutation.mutateAsync({
                sessionId,
                resolutions,
            });
            onResolutionsSaved(updatedPlan);
            setPendingResolutions(new Map());
        } catch (err) {
            console.error('Failed to save resolutions:', err);
        }
    }, [sessionId, allResolved, pendingResolutions, saveResolutionsMutation, onResolutionsSaved]);

    // No unresolved items
    if (unresolvedItems.length === 0) {
        return null;
    }

    return (
        <div className="border-t border-amber-200 bg-amber-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-amber-200">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-amber-800">
                        {unresolvedItems.length} Classification{unresolvedItems.length !== 1 ? 's' : ''} Need Review
                    </h3>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-amber-700">
                        {resolvedCount} of {unresolvedItems.length} resolved
                    </span>
                    <button
                        onClick={handleSave}
                        disabled={!allResolved || saveResolutionsMutation.isPending}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 rounded-lg transition-colors"
                    >
                        {saveResolutionsMutation.isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Resolutions
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Items list */}
            <div className="max-h-64 overflow-y-auto">
                {unresolvedItems.map((classification) => {
                    const OutcomeIcon = getOutcomeIcon(classification.outcome);
                    const isExpanded = expandedItem === classification.itemTempId;
                    const pending = pendingResolutions.get(classification.itemTempId);

                    return (
                        <div
                            key={classification.itemTempId}
                            className="border-b border-amber-100 last:border-b-0"
                        >
                            {/* Item row */}
                            <div
                                className="flex items-center gap-3 px-6 py-3 hover:bg-amber-100/50 cursor-pointer"
                                onClick={() => setExpandedItem(isExpanded ? null : classification.itemTempId)}
                            >
                                <OutcomeIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />

                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 truncate">
                                        {getItemTitle(classification.itemTempId)}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">
                                        {classification.rationale}
                                    </p>
                                </div>

                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getConfidenceColor(classification.confidence)}`}>
                                    {classification.confidence}
                                </span>

                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-200 text-amber-800">
                                    {classification.outcome}
                                </span>

                                {pending?.outcome && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                                        → {pending.outcome}
                                    </span>
                                )}

                                <ChevronDown
                                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                            </div>

                            {/* Expanded panel */}
                            {isExpanded && (
                                <div className="px-6 py-4 bg-white border-t border-amber-100">
                                    {/* Candidates (for AMBIGUOUS) */}
                                    {classification.candidates && classification.candidates.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-xs font-medium text-slate-500 mb-2">
                                                Possible fact kinds:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {classification.candidates.map((candidate) => (
                                                    <button
                                                        key={candidate}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleFactKindSelect(classification.itemTempId, candidate);
                                                            handleOutcomeSelect(classification.itemTempId, 'FACT_EMITTED');
                                                        }}
                                                        className={`px-3 py-1 text-sm rounded-full border transition-colors ${pending?.factKind === candidate
                                                            ? 'bg-blue-500 text-white border-blue-500'
                                                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                                                            }`}
                                                    >
                                                        {candidate}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Outcome selection */}
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 mb-2">
                                            Resolve as:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {OUTCOME_OPTIONS.map((option) => {
                                                const Icon = option.icon;
                                                const isSelected = pending?.outcome === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOutcomeSelect(
                                                                classification.itemTempId,
                                                                option.value
                                                            );
                                                        }}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${isSelected
                                                            ? 'bg-slate-800 text-white border-slate-800'
                                                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                                                            }`}
                                                    >
                                                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : option.color}`} />
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ClassificationPanel;
