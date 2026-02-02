/**
 * LinkSearchCombobox
 *
 * Contextual wrapper for SearchCombobox that searches actions and records.
 * Used in MappingsPanel to link entities.
 */

import { Zap, FileText } from 'lucide-react';
import { useMemo, ReactNode } from 'react';
import { clsx } from 'clsx';

import { useSearch } from '@/api/hooks';
import { useAllActions } from '@/api/hooks/actions/actions';
import { useUIStore } from '@/stores';
import type { SearchResult } from '@/types';

import { SearchCombobox, type SearchComboboxItem } from '@autoart/ui';

// ============================================================================
// TYPES
// ============================================================================

export interface LinkItem extends SearchComboboxItem {
    id: string;
    label: string;
    type: 'action' | 'record';
    description?: string;
}

export interface LinkSearchComboboxProps {
    /** Position to anchor the dropdown */
    position: { top: number; left: number };
    /** Allowed target types */
    targetTypes: ('action' | 'record')[];
    /** Called when an item is selected */
    onSelect: (type: 'action' | 'record', id: string) => void;
    /** Called when combobox closes */
    onClose: () => void;
}

// ============================================================================
// ITEM RENDERER
// ============================================================================

function LinkItemRenderer(item: LinkItem, isSelected: boolean): ReactNode {
    const Icon = item.type === 'action' ? Zap : FileText;
    const iconColor = item.type === 'action' ? 'text-purple-500' : 'text-blue-500';

    return (
        <div
            className={clsx(
                'px-3 py-2.5 cursor-pointer flex items-center gap-3 border-b border-slate-50 transition-colors',
                isSelected ? 'bg-blue-50' : 'hover:bg-ws-bg'
            )}
        >
            <div className="w-7 h-7 rounded flex items-center justify-center bg-ws-panel-bg border border-ws-panel-border shrink-0">
                <Icon size={14} className={iconColor} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm text-ws-text-secondary truncate">{item.label}</div>
                {item.description && (
                    <div className="text-xs text-ws-muted truncate">{item.description}</div>
                )}
            </div>
            <span className="text-[10px] text-ws-muted capitalize shrink-0">
                {item.type}
            </span>
        </div>
    );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LinkSearchCombobox({
    position,
    targetTypes,
    onSelect,
    onClose,
}: LinkSearchComboboxProps) {
    const { activeProjectId } = useUIStore();

    // Fetch records via search (we'll filter as user types)
    const { data: searchResults = [], isLoading: searchLoading } = useSearch(
        '', // Empty query fetches recent/all
        activeProjectId ?? undefined,
        targetTypes.includes('record')
    );

    // Fetch actions if action is a target type
    const { data: actionsData, isLoading: actionsLoading } = useAllActions({
        limit: 50,
        refetch: false,
    });

    const isLoading = searchLoading || actionsLoading;

    // Stabilize targetTypes to avoid unnecessary recomputation
    const includesAction = targetTypes.includes('action');
    const includesRecord = targetTypes.includes('record');

    // Transform to LinkItems
    const items: LinkItem[] = useMemo(() => {
        const result: LinkItem[] = [];

        // Add actions
        if (includesAction) {
            const actions = actionsData?.actions || [];
            for (const action of actions.slice(0, 25)) {
                const title = action.fieldBindings?.find(
                    (b: { fieldKey: string; value?: unknown }) => b.fieldKey === 'title'
                )?.value as string | undefined;
                result.push({
                    id: action.id,
                    label: title || action.type || 'Untitled Action',
                    type: 'action',
                    description: action.type,
                });
            }
        }

        // Add records
        if (includesRecord) {
            for (const r of searchResults.filter((r: SearchResult) => r.type === 'record').slice(0, 25)) {
                result.push({
                    id: r.id,
                    label: r.name || 'Unnamed Record',
                    type: 'record',
                    description: r.definitionName || r.path,
                });
            }
        }

        return result;
    }, [actionsData, searchResults, includesAction, includesRecord]);

    // Custom filter that searches label and description
    const filterFn = (item: LinkItem, query: string) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
            item.label.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q)
        );
    };

    const handleSelect = (item: LinkItem) => {
        onSelect(item.type, item.id);
    };

    return (
        <SearchCombobox<LinkItem>
            items={items}
            onSelect={handleSelect}
            onClose={onClose}
            position={position}
            placeholder="Search actions or records..."
            isLoading={isLoading}
            renderItem={LinkItemRenderer}
            filterFn={filterFn}
            minWidth={360}
            maxWidth={440}
            maxHeight={320}
        />
    );
}
