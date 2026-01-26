/**
 * LinkPickerView
 *
 * Search and select an entity (action or record) to link to the source.
 * Used for creating mappings between emails, actions, and records.
 */

import { Link2, Search, FileText, Zap, Loader2 } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import { useSearch } from '@/api/hooks';
import { useAllActions } from '@/api/hooks/actions/actions';
import { useUIStore } from '@/stores';
import type { SearchResult, Action } from '@/types';

import type { OverlayProps, LinkPickerContext } from '../../../overlay/types';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';

type LinkPickerViewProps = OverlayProps<LinkPickerContext, { targetType: string; targetId: string }>;

interface PickerItem {
    id: string;
    type: 'action' | 'record';
    name: string;
    description?: string;
}

export function LinkPickerView(props: LinkPickerViewProps) {
    const { context, onSubmit, onClose } = props;
    const { sourceType, targetTypes, onSelect } = context;

    const { closeOverlay, activeProjectId } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<PickerItem | null>(null);

    // Fetch records via search
    const { data: searchResults = [], isLoading: searchLoading } = useSearch(
        searchQuery,
        activeProjectId ?? undefined,
        searchQuery.length >= 2 && targetTypes.includes('record')
    );

    // Fetch actions if action is a target type
    const { data: actionsData, isLoading: actionsLoading } = useAllActions({
        limit: 50,
        refetch: false,
    });

    const isLoading = searchLoading || actionsLoading;

    // Transform search results to picker items
    const recordItems: PickerItem[] = useMemo(() => {
        if (!targetTypes.includes('record')) return [];
        return searchResults
            .filter((r: SearchResult) => r.type === 'record')
            .map((r: SearchResult) => ({
                id: r.id,
                type: 'record' as const,
                name: r.name,
                description: r.definitionName || r.path,
            }));
    }, [searchResults, targetTypes]);

    // Transform actions to picker items
    const actionItems: PickerItem[] = useMemo(() => {
        if (!targetTypes.includes('action')) return [];
        const actions = actionsData?.actions || [];
        const query = searchQuery.toLowerCase();

        return actions
            .filter((a: Action) => {
                if (!searchQuery) return true;
                const title = a.fieldBindings?.find(
                    (b: { key: string; value: unknown }) => b.key === 'title'
                )?.value as string | undefined;
                return (
                    title?.toLowerCase().includes(query) ||
                    a.id.toLowerCase().includes(query) ||
                    a.type?.toLowerCase().includes(query)
                );
            })
            .slice(0, 20)
            .map((a: Action) => {
                const title = a.fieldBindings?.find(
                    (b: { key: string; value: unknown }) => b.key === 'title'
                )?.value as string | undefined;
                return {
                    id: a.id,
                    type: 'action' as const,
                    name: title || a.type || 'Untitled Action',
                    description: a.type,
                };
            });
    }, [actionsData, searchQuery, targetTypes]);

    // Combine items
    const allItems = useMemo(() => {
        return [...actionItems, ...recordItems];
    }, [actionItems, recordItems]);

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose();
        } else {
            closeOverlay();
        }
    }, [onClose, closeOverlay]);

    const handleSelect = useCallback(() => {
        if (!selectedItem) return;

        // Call the context callback
        onSelect(selectedItem.type, selectedItem.id);

        // Emit success result
        onSubmit({
            success: true,
            data: { targetType: selectedItem.type, targetId: selectedItem.id },
        });
    }, [selectedItem, onSelect, onSubmit]);

    const getItemIcon = (type: 'action' | 'record') => {
        return type === 'action' ? (
            <Zap size={16} className="text-purple-500" />
        ) : (
            <FileText size={16} className="text-blue-500" />
        );
    };

    return (
        <div className="max-w-lg mx-auto">
            <Stack gap="lg">
                {/* Header */}
                <Inline gap="md" align="start">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                        <Link2 size={24} />
                    </div>
                    <div className="flex-1">
                        <Text size="lg" weight="medium" className="mb-1">
                            Link {sourceType}
                        </Text>
                        <Text size="sm" color="muted">
                            Search for an {targetTypes.join(' or ')} to link to this {sourceType}.
                        </Text>
                    </div>
                </Inline>

                {/* Search input */}
                <div className="relative">
                    <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or ID..."
                        className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                    />
                </div>

                {/* Results list */}
                <div
                    className="bg-slate-50 border border-slate-200 rounded-lg overflow-y-auto"
                    style={{ maxHeight: 280, minHeight: 120 }}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={24} className="animate-spin text-slate-400" />
                        </div>
                    ) : allItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                            <Search size={24} className="mb-2" />
                            <Text size="sm" color="muted">
                                {searchQuery.length < 2
                                    ? 'Type to search...'
                                    : 'No results found'}
                            </Text>
                        </div>
                    ) : (
                        <div className="p-1">
                            {allItems.map((item) => {
                                const isSelected = selectedItem?.id === item.id;
                                return (
                                    <div
                                        key={`${item.type}-${item.id}`}
                                        onClick={() => setSelectedItem(item)}
                                        className={`
                                            cursor-pointer p-3 rounded-md transition-colors
                                            ${isSelected
                                                ? 'bg-blue-50 border border-blue-300'
                                                : 'hover:bg-slate-100 border border-transparent'
                                            }
                                        `}
                                    >
                                        <Inline gap="sm" wrap={false}>
                                            <div className="w-8 h-8 rounded flex items-center justify-center bg-white border border-slate-200">
                                                {getItemIcon(item.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <Text size="sm" weight="medium" truncate>
                                                    {item.name}
                                                </Text>
                                                {item.description && (
                                                    <Text size="xs" color="muted" truncate>
                                                        {item.description}
                                                    </Text>
                                                )}
                                            </div>
                                            <Text
                                                size="xs"
                                                color="muted"
                                                className="capitalize shrink-0"
                                            >
                                                {item.type}
                                            </Text>
                                        </Inline>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Selected indicator */}
                {selectedItem && (
                    <Text size="sm" className="text-blue-600">
                        Selected: {selectedItem.name}
                    </Text>
                )}

                {/* Actions */}
                <Inline justify="end" gap="sm" className="pt-4 border-t border-slate-100">
                    <Button variant="secondary" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSelect} disabled={!selectedItem}>
                        Link
                    </Button>
                </Inline>
            </Stack>
        </div>
    );
}
