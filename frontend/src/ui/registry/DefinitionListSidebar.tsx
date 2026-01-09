/**
 * DefinitionListSidebar
 *
 * Focused sidebar that shows only ONE type of definitions (either records or actions).
 * Used by the separated Records and Actions pages.
 *
 * Unlike RegistrySidebar which shows both, this shows only the relevant definitions
 * for the current page context.
 */

import { useState } from 'react';
import { Plus, Database, Zap, Search, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { useRecordDefinitions, useRecordStats } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';

type DefinitionKind = 'record' | 'action_recipe';

interface DefinitionListSidebarProps {
    width: number;
    selectedDefinitionId: string | null;
    onSelectDefinition: (id: string | null) => void;
    /** Which kind of definitions to show */
    definitionKind: DefinitionKind;
}

/**
 * Sidebar showing a single filtered list of definitions
 */
export function DefinitionListSidebar({
    width,
    selectedDefinitionId,
    onSelectDefinition,
    definitionKind,
}: DefinitionListSidebarProps) {
    const { data: definitions, isLoading } = useRecordDefinitions();
    const { data: stats } = useRecordStats();
    const { openDrawer } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');

    // Legacy hierarchy types to always exclude
    const legacyHierarchyTypes = ['project', 'process', 'stage', 'subprocess'];

    // Filter definitions by kind
    const filteredDefinitions = (definitions || []).filter((def) => {
        const defKind = (def as { definition_kind?: string }).definition_kind;

        if (definitionKind === 'record') {
            if (defKind) return defKind === 'record';
            // Fallback for missing kind: exclude hierarchy and known actions
            const name = def.name.toLowerCase();
            return !legacyHierarchyTypes.includes(name) && name !== 'task' && name !== 'subtask';
        } else {
            if (defKind) return defKind === 'action_recipe';
            // Fallback: check known action names
            const name = def.name.toLowerCase();
            return name === 'task' || name === 'subtask';
        }
    });

    // Apply search filter
    const searchedDefinitions = searchQuery.trim()
        ? filteredDefinitions.filter((def) =>
            def.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : filteredDefinitions;

    const getCount = (definitionId: string): number => {
        if (!stats) return 0;
        const stat = stats.find((s) => s.definitionId === definitionId);
        return stat?.count ?? 0;
    };

    const handleCreate = () => {
        if (definitionKind === 'record') {
            openDrawer('create-definition', { definitionKind: 'record' });
        } else {
            // For actions, open composer
            window.location.href = '/composer';
        }
    };

    const handleEditDefinition = (e: React.MouseEvent, definitionId: string) => {
        e.stopPropagation();
        openDrawer('view-definition', { definitionId });
    };

    const isRecords = definitionKind === 'record';
    const Icon = isRecords ? Database : Zap;
    const title = isRecords ? 'Record Definitions' : 'Action Definitions';
    const iconColor = isRecords ? 'text-blue-500' : 'text-purple-500';
    const emptyMessage = isRecords ? 'No record definitions' : 'No action definitions';
    const instanceLabel = isRecords ? 'record' : 'instance';

    return (
        <aside
            className="bg-slate-50 border-r border-slate-200 flex flex-col shrink-0"
            style={{ width }}
        >
            {/* Header */}
            <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white">
                <div className="flex items-center gap-2">
                    <Icon size={18} className={iconColor} />
                    <span className="font-semibold text-slate-700">{title}</span>
                </div>
                <button
                    onClick={handleCreate}
                    className={clsx(
                        'p-1.5 rounded-md transition-colors',
                        isRecords
                            ? 'text-blue-500 hover:bg-blue-50'
                            : 'text-purple-500 hover:bg-purple-50'
                    )}
                    title={`Create ${isRecords ? 'record' : 'action'} definition`}
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100">
                <div className="relative">
                    <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search definitions..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scroll">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full" />
                    </div>
                ) : searchedDefinitions.length === 0 ? (
                    <div className="text-center py-8 px-4">
                        <p className="text-xs text-slate-400">{emptyMessage}</p>
                    </div>
                ) : (
                    <div className="p-1 space-y-0.5">
                        {/* All option */}
                        <button
                            onClick={() => onSelectDefinition(null)}
                            className={clsx(
                                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
                                selectedDefinitionId === null
                                    ? isRecords ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                    : 'hover:bg-slate-100 text-slate-600'
                            )}
                        >
                            <span className="text-base">📋</span>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">All {isRecords ? 'Records' : 'Actions'}</div>
                                <div className="text-[10px] text-slate-400">
                                    {stats ? stats.reduce((sum, s) => sum + s.count, 0) : 0} total
                                </div>
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
                                            ? isRecords ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                            : 'hover:bg-slate-100 text-slate-600'
                                    )}
                                >
                                    {/* Icon */}
                                    <span className="text-base shrink-0">
                                        {icon || def.name.charAt(0).toUpperCase()}
                                    </span>

                                    {/* Name and Count */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{def.name}</div>
                                        <div className="text-[10px] text-slate-400">
                                            {count} {instanceLabel}{count !== 1 ? 's' : ''}
                                        </div>
                                    </div>

                                    {/* Edit Schema button on hover */}
                                    <button
                                        onClick={(e) => handleEditDefinition(e, def.id)}
                                        className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
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
