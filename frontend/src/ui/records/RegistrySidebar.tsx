import { clsx } from 'clsx';
import { Plus, FolderOpen, Zap, Search, Settings, ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { useState } from 'react';

import { useRecordDefinitions, useRecordStats } from '../../api/hooks';
import { useActionTypeDefinitions, useActionTypeStats } from '../../api/hooks/actionTypes';
import { useFactKindStats } from '../../api/hooks/factKinds';
import { useUIStore } from '../../stores/uiStore';

type RegistrySection = 'records' | 'actions' | 'events';

interface RegistrySidebarProps {
    width: number;
    selectedDefinitionId: string | null;
    onSelectDefinition: (id: string | null, section: RegistrySection) => void;
    activeSection: RegistrySection;
}

/**
 * Registry Sidebar - shows Record Definitions, Action Types, and Event Types
 * 
 * Architecture:
 * - Record Definitions (from record_definitions table) - Data schemas like Contact, Location
 * - Action Types (from action_type_definitions table) - TASK, BUG, STORY, custom types
 * - Event Types - Link to Event Type Catalog for documentation
 * 
 * Updated to use the new action_type_definitions API instead of record_definitions.
 */
export function RegistrySidebar({
    width,
    selectedDefinitionId,
    onSelectDefinition,
    activeSection,
}: RegistrySidebarProps) {
    // Record definitions from legacy table
    const { data: definitions, isLoading: recordsLoading } = useRecordDefinitions();
    const { data: stats } = useRecordStats();

    // Action types from new action_type_definitions table
    const { data: actionTypes = [], isLoading: actionsLoading } = useActionTypeDefinitions();
    const { data: actionTypeStats = [] } = useActionTypeStats();

    // Fact kinds stats
    const { data: factKindStats } = useFactKindStats();

    const { openOverlay } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [recordsExpanded, setRecordsExpanded] = useState(true);
    const [actionsExpanded, setActionsExpanded] = useState(true);
    const [eventsExpanded, setEventsExpanded] = useState(true);

    const isLoading = recordsLoading || actionsLoading;

    // Legacy hierarchy types to exclude
    const legacyHierarchyTypes = ['project', 'process', 'stage', 'subprocess'];

    // Filter record definitions (exclude action_arrangements from old system)
    const recordDefinitions = (definitions || []).filter((def) => {
        const defKind = (def as { definition_kind?: string }).definition_kind;
        if (defKind) return defKind === 'record';
        const name = def.name.toLowerCase();
        return !legacyHierarchyTypes.includes(name) && name !== 'task' && name !== 'subtask';
    });

    // Apply search filter
    const filterRecordsBySearch = searchQuery.trim()
        ? recordDefinitions.filter((def) =>
            def.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : recordDefinitions;

    const filterActionsBySearch = searchQuery.trim()
        ? actionTypes.filter((def) =>
            def.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            def.type.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : actionTypes;

    // Stats helpers
    const getRecordCount = (definitionId: string): number => {
        if (!stats) return 0;
        const stat = stats.find((s) => s.definitionId === definitionId);
        return stat?.count ?? 0;
    };

    const getActionCount = (type: string): number => {
        const stat = actionTypeStats.find((s) => s.type === type);
        return stat?.count ?? 0;
    };

    const handleCreateDefinition = () => {
        openOverlay('create-definition', { definitionKind: 'record' });
    };

    const handleEditDefinition = (e: React.MouseEvent, definitionId: string) => {
        e.stopPropagation();
        openOverlay('view-definition', { definitionId });
    };

    return (
        <aside
            className="bg-slate-50 border-r border-slate-200 flex flex-col shrink-0"
            style={{ width }}
        >
            {/* Header */}
            <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white">
                <div className="flex items-center gap-2">
                    <FolderOpen size={18} className="text-slate-500" />
                    <span className="font-semibold text-slate-700">Registry</span>
                </div>
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

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto custom-scroll">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full" />
                    </div>
                ) : (
                    <>
                        {/* RECORD DEFINITIONS SECTION */}
                        <div className="border-b border-slate-100">
                            <button
                                onClick={() => setRecordsExpanded(!recordsExpanded)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <FolderOpen size={14} className="text-blue-500" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Data Definitions
                                    </span>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {recordDefinitions.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCreateDefinition();
                                        }}
                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Create data definition"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    {recordsExpanded ? (
                                        <ChevronDown size={14} className="text-slate-400" />
                                    ) : (
                                        <ChevronRight size={14} className="text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {recordsExpanded && (
                                <div className="pb-2">
                                    {/* All Records option */}
                                    <div className="px-1 pb-1">
                                        <button
                                            onClick={() => onSelectDefinition(null, 'records')}
                                            className={clsx(
                                                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
                                                selectedDefinitionId === null && activeSection === 'records'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'hover:bg-slate-100 text-slate-600'
                                            )}
                                        >
                                            <span className="text-base">📋</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium">All Records</div>
                                                <div className="text-[10px] text-slate-400">
                                                    {stats ? stats.reduce((sum, s) => sum + s.count, 0) : 0} total
                                                </div>
                                            </div>
                                        </button>
                                    </div>

                                    {/* Record definitions list */}
                                    {filterRecordsBySearch.length === 0 ? (
                                        <div className="text-center py-4 px-2">
                                            <p className="text-xs text-slate-400">No data definitions</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0.5 px-1">
                                            {filterRecordsBySearch.map((def) => {
                                                const count = getRecordCount(def.id);
                                                const isSelected = selectedDefinitionId === def.id && activeSection === 'records';
                                                const icon = def.styling?.icon;

                                                return (
                                                    <div
                                                        key={def.id}
                                                        onClick={() => onSelectDefinition(def.id, 'records')}
                                                        className={clsx(
                                                            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group cursor-pointer',
                                                            isSelected
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : 'hover:bg-slate-100 text-slate-600'
                                                        )}
                                                    >
                                                        <span className="text-base shrink-0">
                                                            {icon || def.name.charAt(0).toUpperCase()}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium truncate">{def.name}</div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {count} record{count !== 1 ? 's' : ''}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleEditDefinition(e, def.id)}
                                                            className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title={`Edit ${def.name} schema`}
                                                        >
                                                            <Settings size={12} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openOverlay('create-record', { definitionId: def.id });
                                                            }}
                                                            className="p-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title={`Create ${def.name}`}
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ACTION TYPES SECTION - Now using action_type_definitions */}
                        <div className="border-b border-slate-100">
                            <button
                                onClick={() => setActionsExpanded(!actionsExpanded)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Zap size={14} className="text-amber-500" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Action Types
                                    </span>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {actionTypes.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {actionsExpanded ? (
                                        <ChevronDown size={14} className="text-slate-400" />
                                    ) : (
                                        <ChevronRight size={14} className="text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {actionsExpanded && (
                                <div className="pb-2">
                                    {/* All Actions option */}
                                    <div className="px-1 pb-1">
                                        <button
                                            onClick={() => onSelectDefinition(null, 'actions')}
                                            className={clsx(
                                                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
                                                selectedDefinitionId === null && activeSection === 'actions'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'hover:bg-slate-100 text-slate-600'
                                            )}
                                        >
                                            <span className="text-base">⚡</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium">All Actions</div>
                                                <div className="text-[10px] text-slate-400">
                                                    {actionTypeStats.reduce((sum, s) => sum + s.count, 0)} total
                                                </div>
                                            </div>
                                        </button>
                                    </div>

                                    {/* Action types list */}
                                    {filterActionsBySearch.length === 0 ? (
                                        <div className="text-center py-4 px-2">
                                            <p className="text-xs text-slate-400">No action types</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0.5 px-1">
                                            {filterActionsBySearch.map((actionType) => {
                                                const count = getActionCount(actionType.type);
                                                const isSelected = selectedDefinitionId === actionType.type && activeSection === 'actions';

                                                return (
                                                    <div
                                                        key={actionType.id}
                                                        onClick={() => onSelectDefinition(actionType.type, 'actions')}
                                                        className={clsx(
                                                            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group cursor-pointer',
                                                            isSelected
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'hover:bg-slate-100 text-slate-600'
                                                        )}
                                                    >
                                                        <div
                                                            className={clsx(
                                                                'w-6 h-6 rounded flex items-center justify-center text-xs font-semibold shrink-0',
                                                                actionType.is_system
                                                                    ? 'bg-amber-100 text-amber-600'
                                                                    : 'bg-purple-100 text-purple-600'
                                                            )}
                                                        >
                                                            {actionType.label.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-sm font-medium truncate">{actionType.label}</span>
                                                                {actionType.is_system && (
                                                                    <span className="px-1 py-0.5 text-[9px] bg-slate-200 text-slate-500 rounded">SYS</span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {count} instance{count !== 1 ? 's' : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* EVENT TYPES SECTION */}
                        <div className="border-b border-slate-100">
                            <button
                                onClick={() => setEventsExpanded(!eventsExpanded)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className="text-blue-500" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Events & Facts
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {eventsExpanded ? (
                                        <ChevronDown size={14} className="text-slate-400" />
                                    ) : (
                                        <ChevronRight size={14} className="text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {eventsExpanded && (
                                <div className="pb-2 px-1 space-y-0.5">
                                    {/* Event Types */}
                                    <button
                                        onClick={() => onSelectDefinition('event-catalog', 'events')}
                                        className={clsx(
                                            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
                                            selectedDefinitionId === 'event-catalog' && activeSection === 'events'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'hover:bg-slate-100 text-slate-600'
                                        )}
                                    >
                                        <Activity size={16} className="text-blue-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium">Event Types</div>
                                            <div className="text-[10px] text-slate-400">15 event types</div>
                                        </div>
                                    </button>

                                    {/* Fact Kinds */}
                                    <button
                                        onClick={() => onSelectDefinition('fact-kinds', 'events')}
                                        className={clsx(
                                            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
                                            selectedDefinitionId === 'fact-kinds' && activeSection === 'events'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'hover:bg-slate-100 text-slate-600'
                                        )}
                                    >
                                        <span className="text-base shrink-0">📊</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium">Fact Kinds</div>
                                            <div className="text-[10px] text-slate-400">
                                                {factKindStats?.total ?? 12} kinds · {factKindStats?.needsReview ?? 0} need review
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Footer Stats */}
            <div className="border-t border-slate-200 px-4 py-3 bg-white">
                <div className="text-xs text-slate-400">
                    {recordDefinitions.length} data · {actionTypes.length} action types
                </div>
            </div>
        </aside>
    );
}
