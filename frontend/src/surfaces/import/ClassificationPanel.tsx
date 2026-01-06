/**
 * Classification Panel
 *
 * Displays classifications and allows the user to resolve them before import.
 * Now shows InterpretationOutput kinds (fact_candidate, action_hint, work_event).
 * Wrapped in a collapsible bottom panel.
 */

import { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, HelpCircle, Check, X, ChevronDown, ChevronUp, Save, Loader2, Lightbulb, Play, FileText, Inbox } from 'lucide-react';
import { useSaveResolutions } from '../../api/hooks/imports';
import type { ImportPlan, Resolution, ItemClassification, InterpretationOutput } from '../../api/hooks/imports';

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
    { value: 'DERIVED_STATE', label: 'Derived State', icon: Play, color: 'text-blue-600' },
    { value: 'INTERNAL_WORK', label: 'Internal Work', icon: Lightbulb, color: 'text-amber-500' },
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
        case 'FACT_EMITTED': return Check;
        case 'INTERNAL_WORK': return Lightbulb;
        case 'DERIVED_STATE': return Play;
        default: return HelpCircle;
    }
}

function getOutputKindBadge(output: InterpretationOutput) {
    switch (output.kind) {
        case 'fact_candidate':
            return { label: output.factKind, color: 'bg-green-100 text-green-700', icon: FileText };
        case 'action_hint':
            return { label: output.hintType, color: 'bg-amber-100 text-amber-700', icon: Lightbulb };
        case 'work_event':
            return { label: output.eventType, color: 'bg-blue-100 text-blue-700', icon: Play };
        case 'field_value':
            return { label: output.field, color: 'bg-purple-100 text-purple-700', icon: Inbox };
        default:
            return { label: 'unknown', color: 'bg-slate-100 text-slate-600', icon: HelpCircle };
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
    const [isCollapsed, setIsCollapsed] = useState(false);

    const saveResolutionsMutation = useSaveResolutions();

    // Get unresolved classifications
    const unresolvedItems = useMemo(() => {
        if (!plan?.classifications) return [];
        return plan.classifications.filter(
            (c) => !c.resolution && (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED')
        );
    }, [plan]);

    // Get all classifications for display
    const allClassifications = useMemo(() => {
        if (!plan?.classifications) return [];
        return plan.classifications;
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

    // No classifications at all
    if (allClassifications.length === 0) {
        return null;
    }

    const needsReview = unresolvedItems.length > 0;

    return (
        <div className="border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
            {/* Collapsible Header */}
            <div
                className={`flex items-center justify-between px-6 py-3 cursor-pointer transition-colors ${needsReview ? 'bg-amber-50 hover:bg-amber-100/50' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-3">
                    {needsReview ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : (
                        <Check className="w-5 h-5 text-green-600" />
                    )}
                    <h3 className={`font-semibold ${needsReview ? 'text-amber-800' : 'text-slate-700'}`}>
                        Classifications
                    </h3>
                    <span className="text-sm text-slate-500">
                        {allClassifications.length} item{allClassifications.length !== 1 ? 's' : ''}
                        {needsReview && (
                            <span className="ml-2 text-amber-600 font-medium">
                                ({unresolvedItems.length} need review)
                            </span>
                        )}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {needsReview && (
                        <>
                            <span className="text-sm text-amber-700">
                                {resolvedCount} of {unresolvedItems.length} resolved
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSave();
                                }}
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
                                        Save
                                    </>
                                )}
                            </button>
                        </>
                    )}
                    {isCollapsed ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </div>
            </div>

            {/* Collapsible Content */}
            {!isCollapsed && (
                <div className="max-h-72 overflow-y-auto border-t border-slate-100">
                    {allClassifications.map((classification) => (
                        <ClassificationRow
                            key={classification.itemTempId}
                            classification={classification}
                            itemTitle={getItemTitle(classification.itemTempId)}
                            isExpanded={expandedItem === classification.itemTempId}
                            onToggle={() => setExpandedItem(
                                expandedItem === classification.itemTempId ? null : classification.itemTempId
                            )}
                            pending={pendingResolutions.get(classification.itemTempId)}
                            onOutcomeSelect={(outcome) => handleOutcomeSelect(classification.itemTempId, outcome)}
                            onFactKindSelect={(factKind) => handleFactKindSelect(classification.itemTempId, factKind)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// CLASSIFICATION ROW
// ============================================================================

interface ClassificationRowProps {
    classification: ItemClassification;
    itemTitle: string;
    isExpanded: boolean;
    onToggle: () => void;
    pending?: PendingResolution;
    onOutcomeSelect: (outcome: PendingResolution['outcome']) => void;
    onFactKindSelect: (factKind: string) => void;
}

function ClassificationRow({
    classification,
    itemTitle,
    isExpanded,
    onToggle,
    pending,
    onOutcomeSelect,
    onFactKindSelect,
}: ClassificationRowProps) {
    const OutcomeIcon = getOutcomeIcon(classification.outcome);
    const needsResolution = !classification.resolution &&
        (classification.outcome === 'AMBIGUOUS' || classification.outcome === 'UNCLASSIFIED');

    // Get outputs from interpretation plan
    const outputs = classification.interpretationPlan?.outputs ?? [];

    return (
        <div className={`border-b border-slate-100 last:border-b-0 ${needsResolution ? 'bg-amber-50/50' : ''}`}>
            {/* Item row */}
            <div
                className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 cursor-pointer"
                onClick={onToggle}
            >
                <OutcomeIcon className={`w-4 h-4 flex-shrink-0 ${needsResolution ? 'text-amber-600' : 'text-slate-400'
                    }`} />

                <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{itemTitle}</p>
                    <p className="text-xs text-slate-500 truncate">{classification.rationale}</p>
                </div>

                {/* Output kind badges */}
                <div className="flex items-center gap-1.5">
                    {outputs.slice(0, 2).map((output, idx) => {
                        const badge = getOutputKindBadge(output);
                        const Icon = badge.icon;
                        return (
                            <span
                                key={idx}
                                className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${badge.color}`}
                            >
                                <Icon className="w-3 h-3" />
                                {badge.label}
                            </span>
                        );
                    })}
                    {outputs.length > 2 && (
                        <span className="text-xs text-slate-400">+{outputs.length - 2}</span>
                    )}
                </div>

                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getConfidenceColor(classification.confidence)}`}>
                    {classification.confidence}
                </span>

                <span className={`px-2 py-0.5 text-xs font-medium rounded ${needsResolution ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
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
                <div className="px-6 py-4 bg-white border-t border-slate-100">
                    {/* Interpretation outputs */}
                    {outputs.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-medium text-slate-500 mb-2">
                                Interpretation outputs:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {outputs.map((output, idx) => {
                                    const badge = getOutputKindBadge(output);
                                    const Icon = badge.icon;
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${badge.color} border-current/20`}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            <span className="text-sm font-medium">{badge.label}</span>
                                            <span className="text-xs opacity-70">({output.kind})</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

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
                                            onFactKindSelect(candidate);
                                            onOutcomeSelect('FACT_EMITTED');
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

                    {/* Outcome selection (only for items needing resolution) */}
                    {needsResolution && (
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
                                                onOutcomeSelect(option.value);
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
                    )}

                    {/* Resolved status */}
                    {classification.resolution && (
                        <div className="flex items-center gap-2 text-sm text-green-700">
                            <Check className="w-4 h-4" />
                            Resolved as: {classification.resolution.resolvedOutcome}
                            {classification.resolution.resolvedFactKind && (
                                <span className="font-medium">({classification.resolution.resolvedFactKind})</span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ClassificationPanel;
