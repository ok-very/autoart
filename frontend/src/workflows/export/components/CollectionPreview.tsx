/**
 * CollectionPreview
 * 
 * Center panel showing start/stop collecting controls and item display.
 */

import { List, LayoutGrid, Code, ChevronRight, ChevronDown, Database, Play, Square } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { SegmentedControl } from '@autoart/ui';

import { useCollectionStore, type SelectionReference } from '../../../stores';
import { CollectionItemCard } from './CollectionItemCard';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'list' | 'cards' | 'raw';

interface GroupedSelection {
    sourceId: string;
    sourceLabel: string;
    items: SelectionReference[];
}

// ============================================================================
// Component
// ============================================================================

export function CollectionPreview() {
    const activeCollection = useCollectionStore(s =>
        s.activeCollectionId ? s.collections.get(s.activeCollectionId) ?? null : null
    );
    const {
        removeFromCollection,
        isCollecting,
        startCollecting,
        stopCollecting,
    } = useCollectionStore();
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Group selections by sourceId
    const groupedSelections = useMemo<GroupedSelection[]>(() => {
        if (!activeCollection) return [];

        const groups = new Map<string, GroupedSelection>();

        for (const item of activeCollection.selections) {
            const existing = groups.get(item.sourceId);
            if (existing) {
                existing.items.push(item);
            } else {
                // Extract source label from first item's displayLabel
                const sourceLabel = item.displayLabel.split(' → ')[0] || item.sourceId.slice(0, 8);
                groups.set(item.sourceId, {
                    sourceId: item.sourceId,
                    sourceLabel,
                    items: [item],
                });
            }
        }

        return Array.from(groups.values());
    }, [activeCollection]);

    const toggleGroup = useCallback((sourceId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(sourceId)) {
                next.delete(sourceId);
            } else {
                next.add(sourceId);
            }
            return next;
        });
    }, []);

    const handleRemove = useCallback((id: string) => {
        removeFromCollection(id);
    }, [removeFromCollection]);

    if (!activeCollection) {
        return (
            <div className="h-full flex items-center justify-center text-ws-muted text-sm">
                Select a collection to preview
            </div>
        );
    }

    // Render controls + content for active collection
    return (
        <div className="flex flex-col h-full">
            {/* Controls Header - Start/Stop Collecting */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-ws-panel-border bg-ws-panel-bg shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]">
                {/* Start/Stop Collecting Button */}
                <button
                    onClick={isCollecting ? stopCollecting : startCollecting}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${isCollecting
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }
                    `}
                >
                    {isCollecting ? (
                        <>
                            <Square size={14} />
                            Stop Collecting
                        </>
                    ) : (
                        <>
                            <Play size={14} />
                            Start Collecting
                        </>
                    )}
                </button>

                {isCollecting && (
                    <span className="text-[10px] text-amber-600">
                        Click items in panels to add them
                    </span>
                )}

                {/* Item count on right */}
                <span className="ml-auto text-xs text-ws-muted">
                    {activeCollection.selections.length} item{activeCollection.selections.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Content Area */}
            {activeCollection.selections.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-ws-muted text-sm">
                    No items in collection
                </div>
            ) : (
                <>
                    {/* View Mode Toggle Header */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-ws-panel-border bg-ws-bg">
                        <span className="text-xs font-medium text-ws-text-secondary">
                            {activeCollection.selections.length} item{activeCollection.selections.length !== 1 ? 's' : ''}
                        </span>

                        <SegmentedControl
                            size="xs"
                            value={viewMode}
                            onChange={(v) => setViewMode(v as ViewMode)}
                            data={[
                                { value: 'list', label: <List size={14} /> },
                                { value: 'cards', label: <LayoutGrid size={14} /> },
                                { value: 'raw', label: <Code size={14} /> },
                            ]}
                        />
                    </div>

                    {/* Items Content */}
                    <div className="flex-1 overflow-y-auto">
                        {viewMode === 'list' && (
                            <ListView
                                groups={groupedSelections}
                                expandedGroups={expandedGroups}
                                onToggleGroup={toggleGroup}
                                onRemove={handleRemove}
                            />
                        )}
                        {viewMode === 'cards' && (
                            <CardsView
                                selections={activeCollection.selections}
                                onRemove={handleRemove}
                            />
                        )}
                        {viewMode === 'raw' && (
                            <RawView selections={activeCollection.selections} />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}




// ============================================================================
// List View (Hierarchical)
// ============================================================================

interface ListViewProps {
    groups: GroupedSelection[];
    expandedGroups: Set<string>;
    onToggleGroup: (id: string) => void;
    onRemove: (id: string) => void;
}

function ListView({ groups, expandedGroups, onToggleGroup, onRemove }: ListViewProps) {
    return (
        <div className="p-2">
            {groups.map(group => {
                const isExpanded = expandedGroups.has(group.sourceId);
                const hasMultiple = group.items.length > 1;

                return (
                    <div key={group.sourceId} className="mb-1">
                        {/* Group Header (only if multiple items) */}
                        {hasMultiple ? (
                            <button
                                onClick={() => onToggleGroup(group.sourceId)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ws-bg text-left"
                            >
                                {isExpanded ? (
                                    <ChevronDown size={14} className="text-ws-muted" />
                                ) : (
                                    <ChevronRight size={14} className="text-ws-muted" />
                                )}
                                <Database size={14} className="text-blue-500" />
                                <span className="text-sm font-medium text-ws-text-secondary truncate">
                                    {group.sourceLabel}
                                </span>
                                <span className="text-[10px] text-ws-muted bg-slate-100 px-1.5 py-0.5 rounded-full ml-auto">
                                    {group.items.length}
                                </span>
                            </button>
                        ) : null}

                        {/* Items */}
                        {(isExpanded || !hasMultiple) && (
                            <div className={hasMultiple ? 'ml-6 border-l border-ws-panel-border pl-2 space-y-2' : 'space-y-2'}>
                                {group.items.map(item => (
                                    <CollectionItemCard
                                        key={item.id}
                                        item={item}
                                        onRemove={onRemove}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}



// ============================================================================
// Cards View
// ============================================================================

interface CardsViewProps {
    selections: SelectionReference[];
    onRemove: (id: string) => void;
}

function CardsView({ selections, onRemove }: CardsViewProps) {
    return (
        <div className="p-3 grid grid-cols-2 gap-3">
            {selections.map(item => (
                <CollectionItemCard
                    key={item.id}
                    item={item}
                    onRemove={onRemove}
                />
            ))}
        </div>
    );
}

// ============================================================================
// Raw View
// ============================================================================

interface RawViewProps {
    selections: SelectionReference[];
}

function RawView({ selections }: RawViewProps) {
    const rawData = useMemo(() => {
        return JSON.stringify(selections, null, 2);
    }, [selections]);

    return (
        <div className="p-3">
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-x-auto font-mono">
                {rawData}
            </pre>
        </div>
    );
}
