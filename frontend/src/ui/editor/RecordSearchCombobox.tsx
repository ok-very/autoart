/**
 * RecordSearchCombobox
 *
 * Record-specific wrapper around SearchCombobox.
 * Handles API search, fuzzy filtering, and record/field selection.
 */

import { clsx } from 'clsx';
import { useMemo, RefObject, ReactNode } from 'react';

import { SearchCombobox, type SearchComboboxItem } from '@autoart/ui';
import { useSearch } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import type { SearchResult } from '../../types';
import { fuzzySearch } from '../../utils/fuzzySearch';

// ============================================================================
// TYPES
// ============================================================================

export interface RecordSearchComboboxProps {
    /** Initial search query */
    query?: string;
    /** Trigger character that opened the combobox (@ or #) */
    triggerChar?: '@' | '#';
    /** Position to anchor the dropdown */
    position: { top: number; left: number };
    /** Callback when item is selected */
    onSelect: (item: SearchResult, fieldKey?: string) => void;
    /** Callback when combobox should close */
    onClose: () => void;
    /** Optional: filter to specific record types */
    definitionId?: string;
    /** Optional: show field selection step (default: true for #, false for @) */
    showFieldSelection?: boolean;
    /** Optional: exclude a specific record ID (for self-reference prevention) */
    excludeRecordId?: string;
    /** Optional: Ref to the parent input element to prevent closing when clicking it */
    parentRef?: RefObject<HTMLElement | null>;
}

// Adapter type to bridge SearchResult to SearchComboboxItem
interface RecordComboboxItem extends SearchComboboxItem {
    originalResult: SearchResult;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RecordSearchCombobox({
    query: initialQuery = '',
    triggerChar = '#',
    position,
    onSelect,
    onClose,
    definitionId,
    showFieldSelection,
    excludeRecordId,
    parentRef,
}: RecordSearchComboboxProps) {
    const { activeProjectId } = useUIStore();

    // Determine if field selection should be shown
    const shouldShowFieldSelection = showFieldSelection ?? triggerChar === '#';

    // Search with API
    const { data: results, isLoading } = useSearch(
        initialQuery,
        activeProjectId || undefined,
        true
    );

    // Transform SearchResult[] to RecordComboboxItem[]
    const items = useMemo<RecordComboboxItem[]>(() => {
        if (!results) return [];

        let filtered = results;

        // Filter by definition if specified
        if (definitionId) {
            filtered = filtered.filter(
                (item) => item.type === 'record' && item.definitionId === definitionId
            );
        }

        // Exclude specific record (for self-reference prevention)
        if (excludeRecordId) {
            filtered = filtered.filter((item) => item.id !== excludeRecordId);
        }

        // Transform to combobox items
        return filtered.map((result) => ({
            id: result.id,
            label: result.name,
            children: shouldShowFieldSelection && result.fields
                ? result.fields.map((f) => ({ id: f.key, label: f.label }))
                : undefined,
            originalResult: result,
        }));
    }, [results, definitionId, excludeRecordId, shouldShowFieldSelection]);

    // Custom filter function using fuzzy search
    const filterFn = useMemo(() => {
        return (item: RecordComboboxItem, query: string): boolean => {
            if (!query.trim()) return true;
            const fuzzyResults = fuzzySearch(query, [item], (i) => i.label, {
                threshold: 0.1,
            });
            return fuzzyResults.length > 0;
        };
    }, []);

    // Handle selection - convert back to SearchResult
    const handleSelect = (item: RecordComboboxItem, childId?: string) => {
        onSelect(item.originalResult, childId);
    };

    // Custom item renderer
    const renderItem = (item: RecordComboboxItem, isSelected: boolean): ReactNode => {
        const result = item.originalResult;
        return (
            <div
                className={clsx(
                    'px-3 py-2.5 cursor-pointer flex items-center gap-2 border-b border-slate-50 transition-colors',
                    isSelected ? 'bg-blue-50' : 'hover:bg-ws-bg'
                )}
            >
                <span
                    className={clsx(
                        'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0',
                        {
                            'bg-blue-100 text-blue-700': result.type === 'record',
                            'bg-purple-100 text-purple-700': result.type === 'node',
                        }
                    )}
                >
                    {result.type === 'record' ? result.definitionName : result.nodeType}
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium text-ws-text-secondary truncate">
                        {result.name}
                    </span>
                    {result.matchedAlias && (
                        <span className="text-[10px] text-ws-muted italic truncate">
                            (matches "{result.matchedAlias}")
                        </span>
                    )}
                </div>
                {result.fields && result.fields.length > 0 && shouldShowFieldSelection && (
                    <span className="text-[10px] text-ws-muted shrink-0">
                        {result.fields.length} fields →
                    </span>
                )}
            </div>
        );
    };

    // Custom child (field) renderer
    const renderChild = (
        child: SearchComboboxItem,
        isSelected: boolean
    ): ReactNode => {
        return (
            <div
                className={clsx(
                    'px-3 py-2.5 cursor-pointer flex items-center gap-3 border-b border-slate-50 transition-colors',
                    isSelected ? 'bg-blue-50' : 'hover:bg-ws-bg'
                )}
            >
                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {child.id}
                </span>
                <span className="text-sm text-ws-text-secondary">{child.label}</span>
            </div>
        );
    };

    // Header prefix with trigger character badge
    const triggerLabel = triggerChar === '@' ? 'Mention' : 'Reference';
    const triggerColor =
        triggerChar === '@'
            ? 'text-purple-600 bg-purple-50'
            : 'text-blue-600 bg-blue-50';

    const headerPrefix = (
        <span className={clsx('text-xs font-semibold px-1.5 py-0.5 rounded', triggerColor)}>
            {triggerChar}
        </span>
    );

    return (
        <SearchCombobox
            items={items}
            onSelect={handleSelect}
            onClose={onClose}
            position={position}
            initialQuery={initialQuery}
            placeholder={`Search ${triggerLabel.toLowerCase()}s...`}
            isLoading={isLoading}
            renderItem={renderItem}
            renderChild={renderChild}
            headerPrefix={headerPrefix}
            showChildSelection={shouldShowFieldSelection}
            childSelectionLabel="Select field from:"
            ignoreRefs={parentRef ? [parentRef] : undefined}
            filterFn={filterFn}
        />
    );
}
