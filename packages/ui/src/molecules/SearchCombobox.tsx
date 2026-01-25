import { clsx } from 'clsx';
import { Search, X, ArrowLeft } from 'lucide-react';
import { useState, useEffect, useCallback, useRef, RefObject, ReactNode, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { useClickOutside } from '../hooks/useClickOutside';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchComboboxItem {
    /** Unique identifier */
    id: string;
    /** Display label for search matching */
    label: string;
    /** Optional children for two-stage selection */
    children?: SearchComboboxItem[];
}

export interface SearchComboboxProps<T extends SearchComboboxItem> {
    /** Items to display */
    items: T[];
    /** Called when an item (or child) is selected */
    onSelect: (item: T, childId?: string) => void;
    /** Called when combobox should close */
    onClose: () => void;

    /** Position to anchor the dropdown */
    position: { top: number; left: number };
    /** Initial search query */
    initialQuery?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Whether data is loading */
    isLoading?: boolean;

    /** Custom item renderer */
    renderItem?: (item: T, isSelected: boolean) => ReactNode;
    /** Custom child renderer (for two-stage selection) */
    renderChild?: (child: SearchComboboxItem, isSelected: boolean, parent: T) => ReactNode;
    /** Custom header content (left of search input) */
    headerPrefix?: ReactNode;

    /** Enable two-stage selection (item -> children) */
    showChildSelection?: boolean;
    /** Label for "back" action in child selection */
    childSelectionLabel?: string;

    /** Refs to elements that should NOT trigger close on click */
    ignoreRefs?: RefObject<HTMLElement | null>[];

    /** Dropdown width constraints */
    minWidth?: number;
    maxWidth?: number;
    maxHeight?: number;

    /** Optional search filter function (if not provided, uses label matching) */
    filterFn?: (item: T, query: string) => boolean;
}

// ============================================================================
// DEFAULT RENDERERS
// ============================================================================

function DefaultItemRenderer<T extends SearchComboboxItem>(
    item: T,
    isSelected: boolean
): ReactNode {
    return (
        <div
            className={clsx(
                'px-3 py-2.5 cursor-pointer flex items-center gap-2 border-b border-slate-50 transition-colors',
                isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
            )}
        >
            <span className="text-sm text-slate-700 truncate">{item.label}</span>
            {item.children && item.children.length > 0 && (
                <span className="text-[10px] text-slate-400 ml-auto shrink-0">
                    {item.children.length} →
                </span>
            )}
        </div>
    );
}

function DefaultChildRenderer(
    child: SearchComboboxItem,
    isSelected: boolean
): ReactNode {
    return (
        <div
            className={clsx(
                'px-3 py-2.5 cursor-pointer flex items-center gap-3 border-b border-slate-50 transition-colors',
                isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
            )}
        >
            <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {child.id}
            </span>
            <span className="text-sm text-slate-700">{child.label}</span>
        </div>
    );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SearchCombobox<T extends SearchComboboxItem>({
    items,
    onSelect,
    onClose,
    position,
    initialQuery = '',
    placeholder = 'Search...',
    isLoading = false,
    renderItem = DefaultItemRenderer,
    renderChild = DefaultChildRenderer,
    headerPrefix,
    showChildSelection = false,
    childSelectionLabel = 'Select from:',
    ignoreRefs = [],
    minWidth = 320,
    maxWidth = 420,
    maxHeight = 400,
    filterFn,
}: SearchComboboxProps<T>) {
    const [query, setQuery] = useState(initialQuery);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedItem, setSelectedItem] = useState<T | null>(null);
    const [showChildren, setShowChildren] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useClickOutside([containerRef, ...ignoreRefs], onClose);

    // Filter items based on query
    const filteredItems = useMemo(() => {
        if (!query.trim()) return items;

        const lowerQuery = query.toLowerCase();
        if (filterFn) {
            return items.filter((item) => filterFn(item, query));
        }
        return items.filter((item) =>
            item.label.toLowerCase().includes(lowerQuery)
        );
    }, [items, query, filterFn]);

    // Get children when in child selection mode
    const currentChildren = useMemo(() => {
        if (!showChildren || !selectedItem?.children) return [];
        return selectedItem.children;
    }, [showChildren, selectedItem]);

    // Reset selection when items change
    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredItems, currentChildren]);

    // Focus input on mount, or container when in child mode
    useEffect(() => {
        if (showChildren) {
            containerRef.current?.focus();
        } else {
            inputRef.current?.focus();
        }
    }, [showChildren]);

    const selectItem = useCallback(
        (index: number) => {
            const item = filteredItems[index];
            if (!item) return;

            if (showChildSelection && item.children && item.children.length > 0) {
                setSelectedItem(item);
                setShowChildren(true);
                setSelectedIndex(0);
            } else {
                onSelect(item);
            }
        },
        [filteredItems, onSelect, showChildSelection]
    );

    const selectChild = useCallback(
        (childId: string) => {
            if (selectedItem) {
                onSelect(selectedItem, childId);
            }
        },
        [selectedItem, onSelect]
    );

    const goBack = useCallback(() => {
        setShowChildren(false);
        setSelectedItem(null);
        setQuery('');
    }, []);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            const currentItems = showChildren ? currentChildren : filteredItems;

            switch (event.key) {
                case 'ArrowUp':
                    event.preventDefault();
                    setSelectedIndex((prev) =>
                        prev <= 0 ? currentItems.length - 1 : prev - 1
                    );
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    setSelectedIndex((prev) =>
                        prev >= currentItems.length - 1 ? 0 : prev + 1
                    );
                    break;
                case 'Enter':
                    event.preventDefault();
                    if (showChildren && currentChildren[selectedIndex]) {
                        selectChild(currentChildren[selectedIndex].id);
                    } else if (!showChildren && filteredItems[selectedIndex]) {
                        selectItem(selectedIndex);
                    }
                    break;
                case 'Escape':
                    event.preventDefault();
                    if (showChildren) {
                        goBack();
                    } else {
                        onClose();
                    }
                    break;
                case 'Backspace':
                    if (showChildren && query === '') {
                        goBack();
                    }
                    break;
            }
        },
        [
            showChildren,
            currentChildren,
            filteredItems,
            selectedIndex,
            selectChild,
            selectItem,
            goBack,
            onClose,
            query,
        ]
    );

    const dropdown = (
        <div
            ref={containerRef}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="fixed bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-[9999] outline-none"
            style={{
                top: position.top,
                left: position.left,
                minWidth,
                maxWidth,
                maxHeight,
            }}
        >
            {/* Search Header */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                {showChildren && selectedItem ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={goBack}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
                        >
                            <ArrowLeft size={14} />
                        </button>
                        <span className="text-xs text-slate-500">{childSelectionLabel}</span>
                        <span className="text-sm font-medium text-slate-700 truncate">
                            {selectedItem.label}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        {headerPrefix}
                        <div className="flex-1 relative">
                            <Search
                                size={14}
                                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={placeholder}
                                className="w-full pl-7 pr-8 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            {query && (
                                <button
                                    onClick={() => setQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Results - subtract header (~52px) and footer (~28px) heights, with floor at 0 */}
            <div className="overflow-y-auto" style={{ maxHeight: Math.max(0, maxHeight - 80) }}>
                {isLoading ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                        <div className="inline-block animate-spin w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full mr-2" />
                        Searching...
                    </div>
                ) : showChildren ? (
                    currentChildren.length === 0 || !selectedItem ? (
                        <div className="p-4 text-center text-slate-400 text-sm">
                            No items available
                        </div>
                    ) : (
                        currentChildren.map((child, index) => (
                            <div key={child.id} onClick={() => selectChild(child.id)}>
                                {renderChild(child, index === selectedIndex, selectedItem)}
                            </div>
                        ))
                    )
                ) : filteredItems.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                        {query ? 'No matches found' : 'Type to search...'}
                    </div>
                ) : (
                    filteredItems.map((item, index) => (
                        <div key={item.id} onClick={() => selectItem(index)}>
                            {renderItem(item, index === selectedIndex)}
                        </div>
                    ))
                )}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>Esc Close</span>
            </div>
        </div>
    );

    // SSR guard: don't render portal if document is not available
    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(dropdown, document.body);
}
