/**
 * CollectionPreview
 * 
 * Preview panel showing collected selections in hierarchical, card, or raw views.
 * Displays selections grouped by source with relative paths.
 */

import { List, LayoutGrid, Code, X, ChevronRight, ChevronDown, FileText, Database, Hash, Calendar, User } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { SegmentedControl } from '@autoart/ui';

import { useCollectionStore, type SelectionReference, type SelectionType } from '../../stores';

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
// Icons by selection type
// ============================================================================

const TYPE_ICONS: Record<SelectionType, React.ElementType> = {
    record: Database,
    field: Hash,
    node: FileText,
    action: Calendar,
    event: User,
};

const TYPE_COLORS: Record<SelectionType, string> = {
    record: 'text-blue-500 bg-blue-50',
    field: 'text-violet-500 bg-violet-50',
    node: 'text-emerald-500 bg-emerald-50',
    action: 'text-amber-500 bg-amber-50',
    event: 'text-pink-500 bg-pink-50',
};

// ============================================================================
// Component
// ============================================================================

export function CollectionPreview() {
    const { activeCollection, removeFromCollection } = useCollectionStore();
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
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Select a collection to preview
            </div>
        );
    }

    if (activeCollection.selections.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No items in collection
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header with view toggles on right */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
                <span className="text-xs font-medium text-slate-500">
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

            {/* Content */}
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
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-left"
                            >
                                {isExpanded ? (
                                    <ChevronDown size={14} className="text-slate-400" />
                                ) : (
                                    <ChevronRight size={14} className="text-slate-400" />
                                )}
                                <Database size={14} className="text-blue-500" />
                                <span className="text-sm font-medium text-slate-700 truncate">
                                    {group.sourceLabel}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full ml-auto">
                                    {group.items.length}
                                </span>
                            </button>
                        ) : null}

                        {/* Items */}
                        {(isExpanded || !hasMultiple) && (
                            <div className={hasMultiple ? 'ml-6 border-l border-slate-200 pl-2' : ''}>
                                {group.items.map(item => (
                                    <SelectionItem
                                        key={item.id}
                                        item={item}
                                        onRemove={onRemove}
                                        showSource={!hasMultiple}
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
// Selection Item (used in list view)
// ============================================================================

interface SelectionItemProps {
    item: SelectionReference;
    onRemove: (id: string) => void;
    showSource?: boolean;
}

function SelectionItem({ item, onRemove, showSource = false }: SelectionItemProps) {
    const Icon = TYPE_ICONS[item.type];
    const colorClass = TYPE_COLORS[item.type];

    // Parse display label for path
    const parts = item.displayLabel.split(' → ');
    const fieldLabel = parts[parts.length - 1] || item.displayLabel;

    // Format value preview
    const valuePreview = useMemo(() => {
        if (item.value === undefined || item.value === null) return null;
        if (typeof item.value === 'string') return item.value.slice(0, 50);
        if (typeof item.value === 'number') return String(item.value);
        if (typeof item.value === 'boolean') return item.value ? 'Yes' : 'No';
        return JSON.stringify(item.value).slice(0, 50);
    }, [item.value]);

    return (
        <div className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50">
            <div className={`w-5 h-5 rounded flex items-center justify-center ${colorClass}`}>
                <Icon size={12} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                    {showSource && parts.length > 1 && (
                        <>
                            <span className="text-[10px] text-slate-400 truncate">
                                {parts.slice(0, -1).join(' → ')}
                            </span>
                            <ChevronRight size={10} className="text-slate-300 flex-shrink-0" />
                        </>
                    )}
                    <span className="text-sm text-slate-700 font-medium truncate">
                        {fieldLabel}
                    </span>
                </div>
                {valuePreview && (
                    <div className="text-[11px] text-slate-400 truncate">
                        {valuePreview}
                    </div>
                )}
            </div>

            <button
                onClick={() => onRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                title="Remove"
            >
                <X size={12} />
            </button>
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
        <div className="p-3 grid grid-cols-2 gap-2">
            {selections.map(item => {
                const Icon = TYPE_ICONS[item.type];
                const colorClass = TYPE_COLORS[item.type];

                return (
                    <div
                        key={item.id}
                        className="group relative p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all"
                    >
                        <button
                            onClick={() => onRemove(item.id)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                        >
                            <X size={12} />
                        </button>

                        <div className="flex items-start gap-2">
                            <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                                <Icon size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-slate-700 truncate">
                                    {item.displayLabel}
                                </div>
                                {item.value !== undefined && (
                                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                        {typeof item.value === 'string'
                                            ? item.value.slice(0, 30)
                                            : JSON.stringify(item.value).slice(0, 30)
                                        }
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
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
