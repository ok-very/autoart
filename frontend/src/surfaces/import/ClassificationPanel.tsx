/**
 * Classification Panel
 *
 * Displays classifications and allows the user to resolve them before import.
 * Now shows InterpretationOutput kinds (fact_candidate, action_hint, work_event).
 * Wrapped in a collapsible bottom panel.
 */

import { AlertTriangle, HelpCircle, Check, ChevronDown, ChevronUp, Save, Loader2, Lightbulb, Play, FileText, Inbox, Sparkles, Clock, ArrowUpRight, ArrowUpDown, MoreVertical, Trash2, Layers, Square, CheckSquare } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import { useSaveResolutions, useClassificationSuggestions } from '../../api/hooks/imports';
import type { ImportPlan, Resolution, ItemClassification, InterpretationOutput, ClassificationSuggestion } from '../../api/hooks/imports';
import { humanizeFactKind, formatRuleSource, toFactKindKey } from '../../utils/formatFactKind';

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
    outcome: 'FACT_EMITTED' | 'DERIVED_STATE' | 'INTERNAL_WORK' | 'EXTERNAL_WORK' | 'DEFERRED' | null;
    factKind?: string;
    hintType?: string; // Track selected hint type for action_hints
    customFactLabel?: string; // User-entered custom fact kind label
}

// ============================================================================
// OUTCOME OPTIONS
// ============================================================================

const OUTCOME_OPTIONS = [
    { value: 'FACT_EMITTED', label: 'Emit as Fact', icon: Check, color: 'text-green-600' },
    { value: 'DERIVED_STATE', label: 'Derived State', icon: Play, color: 'text-blue-600' },
    { value: 'INTERNAL_WORK', label: 'Internal Work', icon: Lightbulb, color: 'text-amber-500' },
    { value: 'EXTERNAL_WORK', label: 'External Work', icon: ArrowUpRight, color: 'text-purple-500' },
    { value: 'DEFERRED', label: 'Defer', icon: Clock, color: 'text-slate-500' },
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
            return { label: humanizeFactKind(output.factKind), color: 'bg-green-100 text-green-700', icon: FileText };
        case 'action_hint':
            return { label: output.hintType?.charAt(0).toUpperCase() + (output.hintType?.slice(1) ?? ''), color: 'bg-amber-100 text-amber-700', icon: Lightbulb };
        case 'work_event':
            return { label: humanizeFactKind(output.eventType), color: 'bg-blue-100 text-blue-700', icon: Play };
        case 'field_value':
            return { label: output.field, color: 'bg-purple-100 text-purple-700', icon: Inbox };
        default:
            return { label: 'unknown', color: 'bg-slate-100 text-slate-600', icon: HelpCircle };
    }
}

/** Format suggestion label - prefer inferredLabel, then humanize fact kinds */
function formatSuggestionLabel(suggestion: ClassificationSuggestion): string {
    // Use inferred label if available (human-readable from inference)
    if (suggestion.inferredLabel) {
        return suggestion.inferredLabel;
    }
    if (suggestion.factKind) {
        return humanizeFactKind(suggestion.factKind);
    }
    if (suggestion.hintType) {
        // Capitalize first letter: 'request' -> 'Request'
        return suggestion.hintType.charAt(0).toUpperCase() + suggestion.hintType.slice(1);
    }
    return 'Unknown';
}

/** Check if a suggestion is currently selected */
function isSuggestionSelected(suggestion: ClassificationSuggestion, pending?: PendingResolution): boolean {
    if (suggestion.factKind) {
        return pending?.factKind === suggestion.factKind;
    }
    if (suggestion.hintType) {
        return pending?.hintType === suggestion.hintType;
    }
    return false;
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
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [sortUnresolvedFirst, setSortUnresolvedFirst] = useState(true);
    const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

    const saveResolutionsMutation = useSaveResolutions();

    // Fetch suggestions for unclassified items
    const { data: suggestions } = useClassificationSuggestions(sessionId);

    // Get unresolved classifications
    const unresolvedItems = useMemo(() => {
        if (!plan?.classifications) return [];
        return plan.classifications.filter(
            (c) => !c.resolution && (c.outcome === 'AMBIGUOUS' || c.outcome === 'UNCLASSIFIED')
        );
    }, [plan]);

    // Group unresolved items by their primary field name (for bulk selection)
    const groupedByField = useMemo(() => {
        const groups = new Map<string, ItemClassification[]>();
        for (const c of unresolvedItems) {
            // Get the first field_value output's field name, or use outcome as fallback
            const fieldOutput = c.interpretationPlan?.outputs?.find(o => o.kind === 'field_value');
            const key = (fieldOutput?.field as string) ?? c.outcome ?? 'Other';
            const existing = groups.get(key) ?? [];
            groups.set(key, [...existing, c]);
        }
        return groups;
    }, [unresolvedItems]);

    // Get all classifications for display (with optional sorting)
    const allClassifications = useMemo(() => {
        if (!plan?.classifications) return [];
        if (!sortUnresolvedFirst) return plan.classifications;

        // Sort: unresolved items first, then by title
        return [...plan.classifications].sort((a, b) => {
            const aNeeds = !a.resolution && (a.outcome === 'AMBIGUOUS' || a.outcome === 'UNCLASSIFIED');
            const bNeeds = !b.resolution && (b.outcome === 'AMBIGUOUS' || b.outcome === 'UNCLASSIFIED');
            if (aNeeds && !bNeeds) return -1;
            if (!aNeeds && bNeeds) return 1;
            return 0;
        });
    }, [plan, sortUnresolvedFirst]);

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
            next.set(itemTempId, { ...existing, factKind, hintType: undefined });
            return next;
        });
    }, []);

    // Handle hint type selection (for action_hints)
    const handleHintTypeSelect = useCallback((itemTempId: string, hintType: string) => {
        setPendingResolutions((prev) => {
            const next = new Map(prev);
            const existing = next.get(itemTempId) ?? { itemTempId, outcome: 'INTERNAL_WORK' };
            next.set(itemTempId, { ...existing, hintType, factKind: undefined, outcome: 'INTERNAL_WORK' });
            return next;
        });
    }, []);

    // Handle custom fact kind label input
    const handleCustomFactLabelChange = useCallback((itemTempId: string, customLabel: string) => {
        setPendingResolutions((prev) => {
            const next = new Map(prev);
            const existing = next.get(itemTempId) ?? { itemTempId, outcome: 'FACT_EMITTED' };
            // Convert label to snake case for factKind
            const factKind = customLabel ? toFactKindKey(customLabel) : undefined;
            next.set(itemTempId, { ...existing, customFactLabel: customLabel, factKind, outcome: 'FACT_EMITTED' });
            return next;
        });
    }, []);

    // Count items with suggestions
    const itemsWithSuggestions = useMemo(() => {
        if (!suggestions) return [];
        return unresolvedItems.filter((item) => {
            const itemSuggestions = suggestions[item.itemTempId];
            return itemSuggestions && itemSuggestions.length > 0;
        });
    }, [suggestions, unresolvedItems]);

    // Handle Accept All Suggestions
    const handleAcceptAllSuggestions = useCallback(() => {
        if (!suggestions) return;
        setPendingResolutions((prev) => {
            const next = new Map(prev);
            for (const item of itemsWithSuggestions) {
                const topSuggestion = suggestions[item.itemTempId]?.[0];
                if (topSuggestion) {
                    if (topSuggestion.factKind) {
                        next.set(item.itemTempId, {
                            itemTempId: item.itemTempId,
                            outcome: 'FACT_EMITTED',
                            factKind: topSuggestion.factKind,
                        });
                    } else if (topSuggestion.hintType) {
                        next.set(item.itemTempId, {
                            itemTempId: item.itemTempId,
                            outcome: 'INTERNAL_WORK',
                            hintType: topSuggestion.hintType,
                        });
                    }
                }
            }
            return next;
        });
    }, [suggestions, itemsWithSuggestions]);

    // Handle Defer Remaining (only items without pending resolutions)
    const handleDeferRemaining = useCallback(() => {
        setPendingResolutions((prev) => {
            const next = new Map(prev);
            for (const item of unresolvedItems) {
                // Only defer items that haven't been resolved yet
                if (!next.has(item.itemTempId) || next.get(item.itemTempId)?.outcome === null) {
                    next.set(item.itemTempId, {
                        itemTempId: item.itemTempId,
                        outcome: 'DEFERRED',
                    });
                }
            }
            return next;
        });
        setBulkMenuOpen(false);
    }, [unresolvedItems]);

    // Handle Defer All Unresolved
    const handleDeferAll = useCallback(() => {
        setPendingResolutions((prev) => {
            const next = new Map(prev);
            for (const item of unresolvedItems) {
                next.set(item.itemTempId, {
                    itemTempId: item.itemTempId,
                    outcome: 'DEFERRED',
                });
            }
            return next;
        });
        setBulkMenuOpen(false);
    }, [unresolvedItems]);

    // Handle Clear All Pending
    const handleClearPending = useCallback(() => {
        setPendingResolutions(new Map());
        setBulkMenuOpen(false);
    }, []);

    // Handle group selection toggle
    const handleToggleGroup = useCallback((groupKey: string) => {
        setSelectedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    }, []);

    // Handle bulk outcome for selected groups
    const handleBulkGroupOutcome = useCallback((outcome: PendingResolution['outcome']) => {
        const itemsInSelectedGroups: string[] = [];
        for (const [key, items] of groupedByField.entries()) {
            if (selectedGroups.has(key)) {
                items.forEach(item => itemsInSelectedGroups.push(item.itemTempId));
            }
        }
        setPendingResolutions(prev => {
            const next = new Map(prev);
            for (const itemTempId of itemsInSelectedGroups) {
                next.set(itemTempId, { itemTempId, outcome });
            }
            return next;
        });
        setSelectedGroups(new Set());
    }, [groupedByField, selectedGroups]);

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
            // Show success message
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
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
        <div className="border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)] flex flex-col h-full">
            {/* Collapsible Header */}
            <div
                className={`flex items-center justify-between px-6 py-3 cursor-pointer transition-colors shrink-0 ${needsReview ? 'bg-amber-50 hover:bg-amber-100/50' : 'bg-slate-50 hover:bg-slate-100'
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
                    {/* Success toast */}
                    {saveSuccess && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full animate-pulse">
                            ✓ Saved!
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {needsReview && (
                        <>
                            {/* Batch: Accept All Suggestions */}
                            {itemsWithSuggestions.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAcceptAllSuggestions();
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                    title={`Accept top suggestion for ${itemsWithSuggestions.length} items`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Accept Suggestions ({itemsWithSuggestions.length})
                                </button>
                            )}
                            {/* Sort Toggle */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSortUnresolvedFirst(!sortUnresolvedFirst);
                                }}
                                className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${sortUnresolvedFirst
                                    ? 'text-blue-700 bg-blue-50 border-blue-200'
                                    : 'text-slate-500 bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                                title={sortUnresolvedFirst ? 'Showing unresolved first' : 'Show in original order'}
                            >
                                <ArrowUpDown className="w-3.5 h-3.5" />
                            </button>

                            {/* View Mode Toggle */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setViewMode(viewMode === 'flat' ? 'grouped' : 'flat');
                                }}
                                className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${viewMode === 'grouped'
                                    ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                                    : 'text-slate-500 bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                                title={viewMode === 'grouped' ? 'Switch to flat view' : 'Group by field'}
                            >
                                <Layers className="w-3.5 h-3.5" />
                            </button>

                            {/* Bulk Actions Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setBulkMenuOpen(!bulkMenuOpen);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                                    title="Bulk actions"
                                >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                    Actions
                                </button>
                                {bulkMenuOpen && (
                                    <div
                                        className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Primary action: Defer Remaining */}
                                        <button
                                            onClick={handleDeferRemaining}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 font-medium"
                                        >
                                            <Clock className="w-4 h-4" />
                                            Defer Remaining
                                            <span className="ml-auto text-xs text-slate-400">
                                                {unresolvedItems.length - resolvedCount}
                                            </span>
                                        </button>
                                        <div className="border-t border-slate-100 my-1" />
                                        <button
                                            onClick={handleDeferAll}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                                        >
                                            <Clock className="w-4 h-4" />
                                            Defer All Unresolved
                                        </button>
                                        <button
                                            onClick={handleClearPending}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Clear Pending
                                        </button>
                                    </div>
                                )}
                            </div>
                            <span className="text-sm text-amber-700 mx-1">
                                {resolvedCount}/{unresolvedItems.length}
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
                <div className="flex-1 overflow-y-auto border-t border-slate-100">
                    {/* View mode toggle + Group bulk actions */}
                    {viewMode === 'grouped' && groupedByField.size > 0 && (
                        <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500">
                                    {selectedGroups.size} of {groupedByField.size} groups selected
                                </span>
                            </div>
                            {selectedGroups.size > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleBulkGroupOutcome('DEFERRED')}
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100"
                                    >
                                        <Clock className="w-3 h-3" />
                                        Defer Selected
                                    </button>
                                    <button
                                        onClick={() => handleBulkGroupOutcome('INTERNAL_WORK')}
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100"
                                    >
                                        <Lightbulb className="w-3 h-3" />
                                        Mark Internal
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {viewMode === 'grouped' ? (
                        /* Grouped View */
                        Array.from(groupedByField.entries()).map(([groupKey, items]) => (
                            <div key={groupKey} className="border-b border-slate-100 last:border-b-0">
                                {/* Group Header */}
                                <div
                                    className="flex items-center gap-3 px-6 py-2 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                                    onClick={() => handleToggleGroup(groupKey)}
                                >
                                    {selectedGroups.has(groupKey) ? (
                                        <CheckSquare className="w-4 h-4 text-blue-600" />
                                    ) : (
                                        <Square className="w-4 h-4 text-slate-400" />
                                    )}
                                    <span className="font-medium text-slate-700">{groupKey}</span>
                                    <span className="text-xs text-slate-500">({items.length} items)</span>
                                </div>
                                {/* Group Items */}
                                <div className="pl-4">
                                    {items.map((classification) => (
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
                                            onHintTypeSelect={(hintType) => handleHintTypeSelect(classification.itemTempId, hintType)}
                                            onCustomFactLabelChange={(label) => handleCustomFactLabelChange(classification.itemTempId, label)}
                                            suggestions={suggestions?.[classification.itemTempId]}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        /* Flat View */
                        allClassifications.map((classification) => (
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
                                onHintTypeSelect={(hintType) => handleHintTypeSelect(classification.itemTempId, hintType)}
                                onCustomFactLabelChange={(label) => handleCustomFactLabelChange(classification.itemTempId, label)}
                                suggestions={suggestions?.[classification.itemTempId]}
                            />
                        ))
                    )}
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
    onHintTypeSelect: (hintType: string) => void;
    onCustomFactLabelChange: (label: string) => void;
    suggestions?: ClassificationSuggestion[];
}

function ClassificationRow({
    classification,
    itemTitle,
    isExpanded,
    onToggle,
    pending,
    onOutcomeSelect,
    onFactKindSelect,
    onHintTypeSelect,
    onCustomFactLabelChange,
    suggestions,
}: ClassificationRowProps) {
    const OutcomeIcon = getOutcomeIcon(classification.outcome);
    const needsResolution = !classification.resolution &&
        (classification.outcome === 'AMBIGUOUS' || classification.outcome === 'UNCLASSIFIED');

    // Get outputs from interpretation plan
    const outputs = classification.interpretationPlan?.outputs ?? [];

    // Check if row has expandable content
    const hasExpandableContent = needsResolution ||
        outputs.length > 0 ||
        classification.candidates?.length ||
        (suggestions && suggestions.length > 0) ||
        classification.resolution;

    // Only allow toggle if there's content to show
    const handleRowClick = () => {
        if (hasExpandableContent) {
            onToggle();
        }
    };

    return (
        <div className={`border-b border-slate-100 last:border-b-0 ${needsResolution
            ? 'bg-red-50/60 border-l-4 border-l-red-400'
            : ''
            }`}>
            {/* Item row */}
            <div
                className={`flex items-center gap-3 px-6 py-3 ${hasExpandableContent ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                onClick={handleRowClick}
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
                        {pending.hintType && ` (${formatSuggestionLabel({ hintType: pending.hintType } as ClassificationSuggestion)})`}
                    </span>
                )}

                {/* Only show chevron if expandable */}
                {hasExpandableContent ? (
                    <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                ) : (
                    <div className="w-4 h-4" /> /* Spacer */
                )}
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

                    {/* Suggestions (for UNCLASSIFIED items) */}
                    {classification.outcome === 'UNCLASSIFIED' && suggestions && suggestions.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-medium text-emerald-600 mb-2 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Suggested classifications:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((suggestion, idx) => {
                                    const isSelected = isSuggestionSelected(suggestion, pending);
                                    const label = formatSuggestionLabel(suggestion);
                                    const isFactCandidate = !!suggestion.factKind;

                                    return (
                                        <button
                                            key={suggestion.ruleId + idx}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (suggestion.factKind) {
                                                    onFactKindSelect(suggestion.factKind);
                                                    onOutcomeSelect('FACT_EMITTED');
                                                } else if (suggestion.hintType) {
                                                    onHintTypeSelect(suggestion.hintType);
                                                }
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${isSelected
                                                ? 'bg-emerald-500 text-white border-emerald-500'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400'
                                                }`}
                                            title={suggestion.reason}
                                        >
                                            {isFactCandidate ? (
                                                <FileText className="w-3 h-3" />
                                            ) : (
                                                <Lightbulb className="w-3 h-3" />
                                            )}
                                            <span className="font-medium">{label}</span>
                                            <span className={`text-[10px] px-1 py-0.5 rounded ${isSelected
                                                ? 'bg-white/20 text-white'
                                                : suggestion.confidence === 'high'
                                                    ? 'bg-green-100 text-green-700'
                                                    : suggestion.confidence === 'medium'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-red-100 text-red-700'
                                                }`}>
                                                {suggestion.matchScore}%
                                            </span>
                                            {/* Rule source tag */}
                                            <span className={`text-[9px] px-1 py-0.5 rounded ${isSelected ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                [{formatRuleSource(suggestion.ruleSource ?? '')}]
                                            </span>
                                        </button>
                                    );
                                })}
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

                            {/* Custom fact kind input - appears when FACT_EMITTED is selected */}
                            {pending?.outcome === 'FACT_EMITTED' && !pending?.factKind && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                                        Or enter a custom fact type:
                                    </label>
                                    <input
                                        type="text"
                                        value={pending?.customFactLabel ?? ''}
                                        onChange={(e) => onCustomFactLabelChange(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="e.g., Fee Proposal Submitted"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
                                    />
                                    {pending?.customFactLabel && (
                                        <p className="mt-1.5 text-xs text-slate-500">
                                            Will be stored as: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{toFactKindKey(pending.customFactLabel)}</code>
                                        </p>
                                    )}
                                </div>
                            )}
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
            )
            }
        </div >
    );
}

export default ClassificationPanel;
