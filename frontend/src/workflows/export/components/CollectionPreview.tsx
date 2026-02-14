/**
 * CollectionPreview
 *
 * Center panel showing start/stop collecting controls and item display.
 * Supports drag-and-drop reorder in list view via HTML5 drag API.
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
        reorderSelections,
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

    // Build flat index lookup: item.id → index in selections[]
    const flatIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        if (activeCollection) {
            activeCollection.selections.forEach((item, i) => map.set(item.id, i));
        }
        return map;
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

    const handleReorder = useCallback((fromId: string, toId: string) => {
        const fromIndex = flatIndexMap.get(fromId);
        const toIndex = flatIndexMap.get(toId);
        if (fromIndex !== undefined && toIndex !== undefined && fromIndex !== toIndex) {
            reorderSelections(fromIndex, toIndex);
        }
    }, [flatIndexMap, reorderSelections]);

    if (!activeCollection) {
        return (
            <div className="h-full flex items-center justify-center text-sm"
                style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                Select a collection to preview
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Controls Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b"
                style={{
                    borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                    background: 'var(--ws-bg, #F5F2ED)',
                }}>
                <button
                    onClick={isCollecting ? stopCollecting : startCollecting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={isCollecting
                        ? {
                            background: 'color-mix(in srgb, var(--ws-color-warning, #B89B5E) 15%, transparent)',
                            color: 'var(--ws-color-warning, #B89B5E)',
                        }
                        : {
                            background: 'color-mix(in srgb, var(--ws-color-success, #6F7F5C) 15%, transparent)',
                            color: 'var(--ws-color-success, #6F7F5C)',
                        }
                    }
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
                    <span className="text-[10px]"
                        style={{ color: 'var(--ws-color-warning, #B89B5E)' }}>
                        Click items in panels to add them
                    </span>
                )}

                <span className="ml-auto text-xs"
                    style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                    {activeCollection.selections.length} item{activeCollection.selections.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Content Area */}
            {activeCollection.selections.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm"
                    style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}>
                    No items in collection
                </div>
            ) : (
                <>
                    {/* View Mode Toggle */}
                    <div className="flex items-center justify-between px-4 py-2 border-b"
                        style={{
                            borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))',
                            background: 'var(--ws-bg, #F5F2ED)',
                        }}>
                        <span className="text-xs font-medium"
                            style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}>
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
                                onReorder={handleReorder}
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
// List View (Hierarchical + Drag-and-Drop)
// ============================================================================

interface ListViewProps {
    groups: GroupedSelection[];
    expandedGroups: Set<string>;
    onToggleGroup: (id: string) => void;
    onRemove: (id: string) => void;
    onReorder: (fromId: string, toId: string) => void;
}

function ListView({ groups, expandedGroups, onToggleGroup, onRemove, onReorder }: ListViewProps) {
    const [dragItemId, setDragItemId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);

    const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
        setDragItemId(itemId);
        e.dataTransfer.effectAllowed = 'move';
        // Use a minimal drag image — the browser default is fine
        e.dataTransfer.setData('text/plain', itemId);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragItemId && dragItemId !== itemId) {
            setDropTargetId(itemId);
        }
    }, [dragItemId]);

    const handleDragLeave = useCallback(() => {
        setDropTargetId(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        setDropTargetId(null);
        if (dragItemId && dragItemId !== targetId) {
            onReorder(dragItemId, targetId);
        }
        setDragItemId(null);
    }, [dragItemId, onReorder]);

    const handleDragEnd = useCallback(() => {
        setDragItemId(null);
        setDropTargetId(null);
    }, []);

    return (
        <div className="p-2">
            {groups.map(group => {
                const isExpanded = expandedGroups.has(group.sourceId);
                const hasMultiple = group.items.length > 1;

                return (
                    <div key={group.sourceId} className="mb-1">
                        {hasMultiple ? (
                            <button
                                onClick={() => onToggleGroup(group.sourceId)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                                style={{ color: 'var(--ws-text-secondary, #5A5A57)' }}
                                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--ws-bg, #F5F2ED)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                {isExpanded ? (
                                    <ChevronDown size={14} style={{ color: 'var(--ws-text-disabled, #8C8C88)' }} />
                                ) : (
                                    <ChevronRight size={14} style={{ color: 'var(--ws-text-disabled, #8C8C88)' }} />
                                )}
                                <Database size={14} style={{ color: 'var(--ws-accent, #3F5C6E)' }} />
                                <span className="text-sm font-medium truncate">
                                    {group.sourceLabel}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto"
                                    style={{
                                        color: 'var(--ws-text-disabled, #8C8C88)',
                                        background: 'color-mix(in srgb, var(--ws-text-disabled, #8C8C88) 12%, transparent)',
                                    }}>
                                    {group.items.length}
                                </span>
                            </button>
                        ) : null}

                        {(isExpanded || !hasMultiple) && (
                            <div className={hasMultiple ? 'ml-6 border-l pl-2 space-y-2' : 'space-y-2'}
                                style={hasMultiple ? { borderColor: 'var(--ws-panel-border, var(--ws-text-disabled, #D6D2CB))' } : undefined}>
                                {group.items.map(item => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.id)}
                                        onDragOver={(e) => handleDragOver(e, item.id)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, item.id)}
                                        onDragEnd={handleDragEnd}
                                        style={dropTargetId === item.id
                                            ? { borderTop: `2px solid var(--ws-accent, #3F5C6E)` }
                                            : undefined
                                        }
                                    >
                                        <CollectionItemCard
                                            item={item}
                                            onRemove={onRemove}
                                            isDragging={dragItemId === item.id}
                                        />
                                    </div>
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
            <pre className="p-3 rounded-lg text-xs overflow-x-auto"
                style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    background: 'var(--ws-mono-bg, rgba(63, 92, 110, 0.035))',
                    color: 'var(--ws-mono-fg, #3A3A38)',
                }}>
                {rawData}
            </pre>
        </div>
    );
}
