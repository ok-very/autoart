/**
 * DefinitionListSidebar
 *
 * Focused sidebar that shows only ONE type of definitions (either records or actions).
 * Used by the separated Records and Actions pages/panels.
 *
 * Integrates FilterBar from @autoart/ui for unified search, sort, and result count display.
 */

import { clsx } from 'clsx';
import { Plus, Database, Zap, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { DefinitionKind } from '@autoart/shared';

import { FilterBar, Spinner } from '@autoart/ui';
import { useRecordDefinitionsFiltered, useRecordStats } from '../../api/hooks';
import { useListFilter } from '../../hooks/useListFilter';
import { useUIStore } from '../../stores/uiStore';

const DEFINITION_FILTER_KEYS = ['name'] as const;

interface DefinitionListSidebarProps {
    width: number;
    selectedDefinitionId: string | null;
    onSelectDefinition: (id: string | null) => void;
    /** Which kind of definitions to show */
    definitionKind: DefinitionKind;
    /** Optional project scope — when set, only shows definitions/stats for this project */
    projectId?: string;
}

/**
 * Sidebar showing a single filtered list of definitions
 */
export function DefinitionListSidebar({
    width,
    selectedDefinitionId,
    onSelectDefinition,
    definitionKind,
    projectId,
}: DefinitionListSidebarProps) {
    const { data: definitions, isLoading } = useRecordDefinitionsFiltered({ definitionKind, projectId });
    const { data: stats } = useRecordStats(projectId);
    const showCounts = definitionKind === 'record';
    const { openOverlay } = useUIStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<'name' | 'created'>('name');

    // Definitions already filtered by kind + project via backend query
    const filteredDefinitions = definitions || [];

    const sortFn = useMemo(() => {
        switch (sortKey) {
            case 'name':
                return (a: typeof filteredDefinitions[number], b: typeof filteredDefinitions[number]) => a.name.localeCompare(b.name);
            case 'created':
                return (a: typeof filteredDefinitions[number], b: typeof filteredDefinitions[number]) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            default:
                return undefined;
        }
    }, [sortKey]);

    const searchedDefinitions = useListFilter(filteredDefinitions, searchQuery, {
        keys: DEFINITION_FILTER_KEYS,
        sortFn,
    });

    const getCount = (definitionId: string): number => {
        if (!stats) return 0;
        const stat = stats.find((s) => s.definitionId === definitionId);
        return stat?.count ?? 0;
    };

    const handleCreate = () => {
        if (definitionKind === 'record') {
            openOverlay('create-definition', { definitionKind: 'record' });
        } else {
            useUIStore.getState().openCommandPalette();
        }
    };

    const handleEditDefinition = (e: React.MouseEvent, definitionId: string) => {
        e.stopPropagation();
        openOverlay('view-definition', { definitionId });
    };

    const isRecords = definitionKind === 'record';
    const Icon = isRecords ? Database : Zap;
    const title = isRecords ? 'Record Definitions' : 'Action Definitions';
    const instanceLabel = isRecords ? 'record' : 'instance';

    return (
        <aside
            className="bg-ws-bg border-r border-ws-panel-border flex flex-col shrink-0"
            style={{ width }}
        >
            {/* Header */}
            <div className="h-10 border-b border-ws-panel-border flex items-center justify-between px-3 bg-ws-panel-bg">
                <div className="flex items-center gap-2">
                    <Icon size={18} className="text-ws-text-secondary" />
                    <span className="font-semibold text-sm text-ws-text-secondary">{title}</span>
                </div>
                <button
                    onClick={handleCreate}
                    className="p-1.5 rounded-md transition-colors text-ws-text-secondary hover:bg-ws-row-expanded-bg"
                    title={`Create ${isRecords ? 'record' : 'action'} definition`}
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Unified filter bar */}
            <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                resultCount={searchedDefinitions.length}
                placeholder={`Filter ${isRecords ? 'records' : 'actions'}...`}
            >
                <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as 'name' | 'created')}
                    className="text-xs px-1.5 py-0.5 rounded border"
                    style={{
                        borderColor: 'var(--ws-panel-border)',
                        backgroundColor: 'var(--ws-panel-bg)',
                        color: 'var(--ws-fg)',
                    }}
                >
                    <option value="name">Name</option>
                    <option value="created">Created</option>
                </select>
            </FilterBar>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scroll">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Spinner size="sm" />
                    </div>
                ) : searchedDefinitions.length === 0 ? (
                    <div className="py-8 px-4">
                        <p className="text-xs text-ws-text-secondary">No definitions found</p>
                    </div>
                ) : (
                    <div className="p-1 space-y-0.5">
                        {/* All option */}
                        <button
                            onClick={() => onSelectDefinition(null)}
                            className={clsx(
                                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
                                selectedDefinitionId === null
                                    ? 'bg-ws-row-expanded-bg text-ws-fg'
                                    : 'hover:bg-ws-row-expanded-bg text-ws-text-secondary'
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">All {isRecords ? 'Records' : 'Actions'}</div>
                                {showCounts && (
                                    <div className="text-[10px] text-ws-text-secondary">
                                        {stats ? stats.reduce((sum, s) => sum + s.count, 0) : 0} total
                                    </div>
                                )}
                            </div>
                        </button>

                        {/* Definition items */}
                        {searchedDefinitions.map((def) => {
                            const count = getCount(def.id);
                            const isSelected = selectedDefinitionId === def.id;
                            const icon = def.styling?.icon;

                            return (
                                <div
                                    key={def.id}
                                    onClick={() => onSelectDefinition(def.id)}
                                    className={clsx(
                                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group cursor-pointer',
                                        isSelected
                                            ? 'bg-ws-row-expanded-bg text-ws-fg'
                                            : 'hover:bg-ws-row-expanded-bg text-ws-text-secondary'
                                    )}
                                >
                                    {/* Icon */}
                                    <span className="text-base shrink-0">
                                        {icon || def.name.charAt(0).toUpperCase()}
                                    </span>

                                    {/* Name and Count */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{def.name}</div>
                                        {showCounts && (
                                            <div className="text-[10px] text-ws-text-secondary">
                                                {count} {instanceLabel}{count !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </div>

                                    {/* Edit Schema button on hover */}
                                    <button
                                        onClick={(e) => handleEditDefinition(e, def.id)}
                                        className="p-1 text-ws-text-secondary hover:text-ws-fg hover:bg-ws-row-expanded-bg rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        title={`Edit ${def.name} schema`}
                                    >
                                        <Settings size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
}
