/**
 * MillerColumn - A single column in the Miller columns browser
 *
 * This is a MOLECULE that displays a list of items at one level.
 * It receives data and callbacks as props - no direct store access.
 *
 * Supports two modes:
 * 1. Hierarchy mode: Pass `type` + `items` as HierarchyNode[] for project browser
 * 2. Generic mode: Pass `title` + `items` as MillerColumnItem[] for fields browser, etc.
 *
 * Optional features:
 * - Checkboxes for inclusive filtering (pass `checkedIds` + `onCheck`)
 * - Search filter (pass `enableSearch`)
 */

import { Plus, ChevronRight, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

import type { HierarchyNode, NodeType } from '../../types';
import { useCollectionModeOptional } from '../../workflows/export/context/CollectionModeProvider';
import { SelectableWrapper } from '../../workflows/export/components/SelectableWrapper';

// ==================== TYPES ====================

/** Generic item shape for non-hierarchy usage */
export interface MillerColumnItem {
    id: string;
    label: string;
    sublabel?: string;
    hasChildren?: boolean;
    badge?: {
        text: string;
        color: string;
    };
    disabled?: boolean;
    /** Arbitrary extra data passed through to onSelect */
    data?: unknown;
}

/** Props for hierarchy mode (original usage) */
export interface MillerColumnHierarchyProps {
    /** Node type for this column - triggers hierarchy mode */
    type: NodeType;
    /** Items to display as HierarchyNode[] */
    items: HierarchyNode[];
    /** Currently selected item ID */
    selectedId: string | null;
    /** Callback when an item is selected */
    onSelect: (id: string) => void;
    /** Callback when add button is clicked */
    onAdd?: () => void;
    /** Function to check if an item has children (shows arrow) */
    hasChildren?: (id: string) => boolean;

    // Generic mode props should not be used
    title?: never;
    checkedIds?: never;
    onCheck?: never;
    enableSearch?: never;
    className?: never;
}

/** Props for generic mode (fields browser, etc.) */
export interface MillerColumnGenericProps {
    /** Title displayed in the header */
    title: string;
    /** Optional badge/icon content for the header */
    headerBadge?: React.ReactNode;
    /** Items to display */
    items: MillerColumnItem[];
    /** Currently selected item ID */
    selectedId?: string | null;
    /** Callback when an item is selected - receives full item */
    onSelect: (item: MillerColumnItem) => void;
    /** Set of checked item IDs (for inclusive filtering) */
    checkedIds?: Set<string>;
    /** Called when an item's checkbox is toggled */
    onCheck?: (item: MillerColumnItem, checked: boolean) => void;
    /** Enable local text search filter */
    enableSearch?: boolean;
    /** Custom container styles */
    className?: string;
    /** Function to generate label for collection selection */
    getCollectionLabel?: (item: MillerColumnItem) => string;

    // Hierarchy mode props should not be used
    type?: never;
    onAdd?: never;
    hasChildren?: never;
}

export type MillerColumnProps = MillerColumnHierarchyProps | MillerColumnGenericProps;

// ==================== CONFIG ====================

const COLUMN_CONFIG: Record<NodeType, { label: string; badge: string; bgColor: string; textColor: string }> = {
    project: { label: 'Projects', badge: 'P', bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
    process: { label: 'Methodology', badge: 'M', bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
    stage: { label: 'Stages', badge: 'F', bgColor: 'bg-yellow-100', textColor: 'text-yellow-600' },
    subprocess: { label: 'Subprocesses', badge: 'S', bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
    task: { label: 'Tasks', badge: 'T', bgColor: 'bg-slate-200', textColor: 'text-slate-600' },
    subtask: { label: 'Subtasks', badge: 'ST', bgColor: 'bg-teal-100', textColor: 'text-teal-600' },
    template: { label: 'Templates', badge: 'TP', bgColor: 'bg-pink-100', textColor: 'text-pink-600' },
};

// ==================== TYPE GUARD ====================

function isHierarchyMode(props: MillerColumnProps): props is MillerColumnHierarchyProps {
    return 'type' in props && props.type !== undefined;
}

// ==================== MILLER COLUMN ====================

export function MillerColumn(props: MillerColumnProps) {
    const [searchQuery, setSearchQuery] = useState('');

    if (isHierarchyMode(props)) {
        return <HierarchyColumn {...props} />;
    }

    return <GenericColumn {...props} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />;
}

// ==================== HIERARCHY COLUMN (original) ====================

function HierarchyColumn({
    type,
    items,
    selectedId,
    onSelect,
    onAdd,
    hasChildren,
}: MillerColumnHierarchyProps) {
    const config = COLUMN_CONFIG[type];

    return (
        <div className="flex-shrink-0 w-80 border-r border-slate-200 bg-white flex flex-col">
            {/* Column Header */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded ${config.bgColor} ${config.textColor} flex items-center justify-center text-xs font-bold`}>
                        {config.badge}
                    </span>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        {config.label}
                    </span>
                </div>
                {onAdd && (
                    <button
                        onClick={onAdd}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title={`Add ${type}`}
                        data-aa-component="MillerColumn"
                        data-aa-id={`add-${type}`}
                        data-aa-action="create"
                    >
                        <Plus size={16} />
                    </button>
                )}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto custom-scroll">
                {items.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400">
                        No {config.label.toLowerCase()} yet
                    </div>
                ) : (
                    items.map((item) => (
                        <HierarchyColumnItem
                            key={item.id}
                            item={item}
                            isSelected={item.id === selectedId}
                            onClick={() => onSelect(item.id)}
                            showArrow={hasChildren ? hasChildren(item.id) : type !== 'task'}
                        />
                    ))
                )}
            </div>

            {/* Footer Stats */}
            <div className="p-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                {items.length} {items.length === 1 ? type : config.label.toLowerCase()}
            </div>
        </div>
    );
}

// ==================== GENERIC COLUMN (new) ====================

interface GenericColumnInternalProps extends MillerColumnGenericProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
}

function GenericColumn({
    title,
    headerBadge,
    items,
    selectedId,
    checkedIds,
    onSelect,
    onCheck,
    enableSearch = false,
    className = '',
    searchQuery,
    setSearchQuery,
    getCollectionLabel,
}: GenericColumnInternalProps) {
    const collectionMode = useCollectionModeOptional();
    const isCollecting = collectionMode?.isCollecting ?? false;
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items;
        const lowerQuery = searchQuery.toLowerCase();
        return items.filter(item =>
            item.label.toLowerCase().includes(lowerQuery) ||
            item.sublabel?.toLowerCase().includes(lowerQuery)
        );
    }, [items, searchQuery]);

    return (
        <div className={`flex-shrink-0 w-72 border-r border-slate-200 bg-white flex flex-col ${className}`}>
            {/* Header */}
            <div className="p-3 flex flex-col gap-2 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {headerBadge}
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            {title}
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        {filteredItems.length}
                    </span>
                </div>

                {/* Optional Search Bar */}
                {enableSearch && (
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter..."
                            className="
                                w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200
                                bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100
                            "
                        />
                    </div>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scroll">
                {filteredItems.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400">
                        {searchQuery ? 'No matches found' : 'No items'}
                    </div>
                ) : (
                    filteredItems.map(item => {
                        const itemContent = (
                            <GenericColumnItem
                                key={item.id}
                                item={item}
                                isSelected={item.id === selectedId}
                                isChecked={checkedIds?.has(item.id)}
                                onSelect={() => onSelect(item)}
                                onCheck={onCheck ? (checked) => onCheck(item, checked) : undefined}
                            />
                        );

                        // Wrap with SelectableWrapper when in collection mode
                        if (isCollecting) {
                            return (
                                <SelectableWrapper
                                    key={item.id}
                                    type="field"
                                    sourceId={item.id}
                                    displayLabel={getCollectionLabel?.(item) ?? item.label}
                                    value={item.data}
                                >
                                    {itemContent}
                                </SelectableWrapper>
                            );
                        }

                        return itemContent;
                    })
                )}
            </div>
        </div>
    );
}

// ==================== HIERARCHY COLUMN ITEM ====================

interface HierarchyColumnItemProps {
    item: HierarchyNode;
    isSelected: boolean;
    onClick: () => void;
    showArrow?: boolean;
}

function HierarchyColumnItem({ item, isSelected, onClick, showArrow = true }: HierarchyColumnItemProps) {
    const metadata = (typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata) as Record<string, unknown> || {};
    const isCompleted = Boolean(metadata.completed);

    return (
        <div
            onClick={onClick}
            className={`
                px-4 py-3 border-b border-slate-100 cursor-pointer
                flex justify-between items-center gap-2
                transition-colors
                ${isSelected
                    ? 'bg-blue-50 border-l-[3px] border-l-blue-500'
                    : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
                }
            `}
            data-aa-component="MillerColumn"
            data-aa-id={`item-${item.id}`}
            data-aa-action="select"
        >
            <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold truncate ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                    {item.title}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                    ID: {item.id.slice(0, 8)}
                </div>
                {item.type === 'subprocess' && (
                    <div className="flex gap-1 mt-1">
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1 rounded border border-emerald-100">
                            Active
                        </span>
                    </div>
                )}
            </div>
            {showArrow && (
                <ChevronRight
                    size={18}
                    className={`flex-shrink-0 transition-opacity ${isSelected ? 'opacity-100 text-blue-500' : 'opacity-30'}`}
                />
            )}
        </div>
    );
}

// ==================== GENERIC COLUMN ITEM ====================

interface GenericColumnItemProps {
    item: MillerColumnItem;
    isSelected?: boolean;
    isChecked?: boolean;
    onSelect: () => void;
    onCheck?: (checked: boolean) => void;
}

function GenericColumnItem({
    item,
    isSelected = false,
    isChecked = false,
    onSelect,
    onCheck,
}: GenericColumnItemProps) {
    const handleRowClick = () => {
        if (item.disabled) return;
        onSelect();
    };

    const handleCheckChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (onCheck && !item.disabled) {
            onCheck(e.target.checked);
        }
    };

    const handleCheckClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div
            onClick={handleRowClick}
            className={`
                group
                px-3 py-2 border-b border-slate-100 cursor-pointer
                flex justify-between items-center gap-3
                transition-colors select-none
                ${isSelected
                    ? 'bg-blue-50 border-l-[3px] border-l-blue-500 pl-[9px]'
                    : 'hover:bg-slate-50 border-l-[3px] border-l-transparent pl-[9px]'
                }
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            role="button"
            aria-selected={isSelected}
            aria-disabled={item.disabled}
        >
            {/* Checkbox for inclusive filtering */}
            {onCheck && (
                <div
                    className="flex-shrink-0 flex items-center justify-center pt-0.5"
                    onClick={handleCheckClick}
                >
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={handleCheckChange}
                        disabled={item.disabled}
                        className="
                            w-4 h-4 rounded border-slate-300 text-blue-600
                            focus:ring-blue-500 cursor-pointer
                            disabled:cursor-not-allowed
                        "
                    />
                </div>
            )}

            {/* Main Content */}
            <div className="min-w-0 flex-1 flex flex-col">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                        {item.label}
                    </span>
                    {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${item.badge.color}`}>
                            {item.badge.text}
                        </span>
                    )}
                </div>
                {item.sublabel && (
                    <span className="text-[11px] text-slate-400 truncate">
                        {item.sublabel}
                    </span>
                )}
            </div>

            {/* Navigation Arrow */}
            {item.hasChildren && (
                <ChevronRight
                    size={16}
                    className={`
                        flex-shrink-0 transition-opacity
                        ${isSelected ? 'opacity-100 text-blue-500' : 'opacity-30 group-hover:opacity-60'}
                    `}
                />
            )}
        </div>
    );
}
