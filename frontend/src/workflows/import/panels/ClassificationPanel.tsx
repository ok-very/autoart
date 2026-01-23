/**
 * Classification Panel
 *
 * Displays classifications and allows the user to resolve them before import.
 * Now shows InterpretationOutput kinds (fact_candidate, action_hint, work_event).
 * Wrapped in a collapsible bottom panel.
 */

import { Save, Loader2, Sparkles, Clock, ArrowUpDown, MoreVertical, Trash2, Layers, CheckSquare, Square, Lightbulb } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useSaveResolutions, useClassificationSuggestions } from '../../../api/hooks/imports';
import type { ImportPlan, Resolution, ItemClassification } from '../../../api/hooks/imports';
import { toFactKindKey } from '../../../utils/formatFactKind';
import { PendingResolution } from '../types';
import { ClassificationRow } from '../components/ClassificationRow';

// ============================================================================
// TYPES
// ============================================================================

interface ClassificationPanelProps {
    sessionId: string | null;
    plan: ImportPlan | null;
    onResolutionsSaved: (updatedPlan: ImportPlan) => void;
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
        <div className="bg-white flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div
                className={`flex items-center justify-between px-4 py-2 border-b border-slate-200 shrink-0 ${needsReview ? 'bg-amber-50/50' : 'bg-white'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">
                        {allClassifications.length} items
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
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
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
        </div>
    );
}

export default ClassificationPanel;
