/**
 * Classification Panel
 *
 * Displays classifications and allows the user to resolve them before import.
 * Now shows InterpretationOutput kinds (fact_candidate, action_hint, work_event).
 * Wrapped in a collapsible bottom panel.
 */

import { Save, Loader2, Sparkles, Clock, ArrowUpDown, Trash2, Layers, Lightbulb, MoreVertical } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useSaveResolutions, useClassificationSuggestions } from '../../../api/hooks/imports';
import type { ImportPlan, Resolution, ItemClassification } from '../../../api/hooks/imports';
import { toFactKindKey } from '../../../utils/formatFactKind';
import { PendingResolution } from '../types';
import { ClassificationRow } from '../components/ClassificationRow';
import { Button, Badge, Text, Inline, IconButton, Checkbox, Menu } from '@autoart/ui';

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
    }, [unresolvedItems]);

    // Handle Clear All Pending
    const handleClearPending = useCallback(() => {
        setPendingResolutions(new Map());
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
        <div className="bg-ws-panel-bg flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <Inline
                gap="sm"
                align="center"
                justify="between"
                wrap={false}
                className={`px-4 py-2 border-b border-ws-panel-border shrink-0 ${needsReview ? 'bg-[color:var(--ws-color-warning)]/5' : 'bg-ws-panel-bg'}`}
            >
                <Inline gap="sm" align="center">
                    <Text size="sm" color="dimmed">
                        {allClassifications.length} items
                    </Text>
                    {needsReview && (
                        <Text size="sm" weight="semibold" className="text-[var(--ws-color-warning)]">
                            ({unresolvedItems.length} need review)
                        </Text>
                    )}
                    {saveSuccess && (
                        <Badge size="xs" variant="success" className="animate-pulse">
                            Saved
                        </Badge>
                    )}
                </Inline>
                <Inline gap="xs" align="center" wrap={false}>
                    {needsReview && (
                        <>
                            {/* Batch: Accept All Suggestions */}
                            {itemsWithSuggestions.length > 0 && (
                                <Button
                                    size="xs"
                                    variant="light"
                                    color="green"
                                    leftSection={<Sparkles className="w-3.5 h-3.5" />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAcceptAllSuggestions();
                                    }}
                                    title={`Accept top suggestion for ${itemsWithSuggestions.length} items`}
                                >
                                    Accept Suggestions ({itemsWithSuggestions.length})
                                </Button>
                            )}

                            {/* Sort Toggle */}
                            <IconButton
                                icon={ArrowUpDown}
                                variant="subtle"
                                size="sm"
                                label={sortUnresolvedFirst ? 'Showing unresolved first' : 'Show in original order'}
                                active={sortUnresolvedFirst}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSortUnresolvedFirst(!sortUnresolvedFirst);
                                }}
                            />

                            {/* View Mode Toggle */}
                            <IconButton
                                icon={Layers}
                                variant="subtle"
                                size="sm"
                                label={viewMode === 'grouped' ? 'Switch to flat view' : 'Group by field'}
                                active={viewMode === 'grouped'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setViewMode(viewMode === 'flat' ? 'grouped' : 'flat');
                                }}
                            />

                            {/* Bulk Actions Dropdown */}
                            <Menu>
                                <Menu.Target>
                                    <Button
                                        size="xs"
                                        variant="subtle"
                                        color="gray"
                                        rightSection={<MoreVertical className="w-3.5 h-3.5" />}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Actions
                                    </Button>
                                </Menu.Target>
                                <Menu.Dropdown align="end">
                                    <Menu.Item
                                        leftSection={<Clock className="w-4 h-4" />}
                                        rightSection={<Text size="xs" color="dimmed">{unresolvedItems.length - resolvedCount}</Text>}
                                        onClick={handleDeferRemaining}
                                    >
                                        Defer Remaining
                                    </Menu.Item>
                                    <Menu.Divider />
                                    <Menu.Item
                                        leftSection={<Clock className="w-4 h-4" />}
                                        onClick={handleDeferAll}
                                    >
                                        Defer All Unresolved
                                    </Menu.Item>
                                    <Menu.Item
                                        leftSection={<Trash2 className="w-4 h-4" />}
                                        onClick={handleClearPending}
                                        className="text-[var(--ws-color-error)]"
                                    >
                                        Clear Pending
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>

                            <Text size="sm" className="text-[var(--ws-color-warning)] mx-1">
                                {resolvedCount}/{unresolvedItems.length}
                            </Text>

                            {/* Save Button */}
                            <Button
                                size="sm"
                                variant="primary"
                                disabled={!allResolved || saveResolutionsMutation.isPending}
                                leftSection={saveResolutionsMutation.isPending
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Save className="w-4 h-4" />
                                }
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSave();
                                }}
                            >
                                {saveResolutionsMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                        </>
                    )}
                </Inline>
            </Inline>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Group bulk actions bar */}
                {viewMode === 'grouped' && groupedByField.size > 0 && (
                    <Inline
                        gap="sm"
                        align="center"
                        justify="between"
                        className="px-6 py-2 bg-ws-bg border-b border-ws-panel-border"
                    >
                        <Text size="xs" weight="semibold" color="dimmed">
                            {selectedGroups.size} of {groupedByField.size} groups selected
                        </Text>
                        {selectedGroups.size > 0 && (
                            <Inline gap="xs" align="center">
                                <Button
                                    size="xs"
                                    variant="light"
                                    color="yellow"
                                    leftSection={<Clock className="w-3 h-3" />}
                                    onClick={() => handleBulkGroupOutcome('DEFERRED')}
                                >
                                    Defer Selected
                                </Button>
                                <Button
                                    size="xs"
                                    variant="light"
                                    color="violet"
                                    leftSection={<Lightbulb className="w-3 h-3" />}
                                    onClick={() => handleBulkGroupOutcome('INTERNAL_WORK')}
                                >
                                    Mark Internal
                                </Button>
                            </Inline>
                        )}
                    </Inline>
                )}

                {viewMode === 'grouped' ? (
                    /* Grouped View */
                    Array.from(groupedByField.entries()).map(([groupKey, items]) => (
                        <div key={groupKey} className="border-b border-ws-panel-border last:border-b-0">
                            {/* Group Header */}
                            <Inline
                                gap="sm"
                                align="center"
                                className="px-6 py-2 bg-ws-bg hover:bg-ws-row-expanded-bg cursor-pointer"
                                onClick={() => handleToggleGroup(groupKey)}
                            >
                                <Checkbox
                                    checked={selectedGroups.has(groupKey)}
                                    onChange={() => handleToggleGroup(groupKey)}
                                />
                                <Text size="sm" weight="semibold" color="dimmed">{groupKey}</Text>
                                <Text size="xs" color="dimmed">({items.length} items)</Text>
                            </Inline>
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
