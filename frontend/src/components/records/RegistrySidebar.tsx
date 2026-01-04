import { useState } from 'react';
import { Plus, FolderOpen, Zap, Search, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useRecordDefinitions, useRecordStats } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';

type RegistrySection = 'records' | 'actions';

interface RegistrySidebarProps {
    width: number;
    selectedDefinitionId: string | null;
    onSelectDefinition: (id: string | null, section: RegistrySection) => void;
    activeSection: RegistrySection;
}

/**
 * Registry Sidebar - shows both Record Types and Action Types
 * 
 * Architecture:
 * - Record Types (kind='record') - Data definitions like Contact, Location, Artwork
 * - Action Types (kind='action_recipe') - Action recipes like Task, Subtask, Meeting
 * 
 * This replaces RecordTypeSidebar with a unified registry view.
 */
export function RegistrySidebar({
    width,
    selectedDefinitionId,
    onSelectDefinition,
    activeSection,
}: RegistrySidebarProps) {
    const { data: definitions, isLoading } = useRecordDefinitions();
    const { data: stats } = useRecordStats();
    const { openDrawer } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [recordsExpanded, setRecordsExpanded] = useState(true);
    const [actionsExpanded, setActionsExpanded] = useState(true);

    // Legacy hierarchy types to always exclude
    const legacyHierarchyTypes = ['project', 'process', 'stage', 'subprocess'];

    // Split definitions by kind
    const recordDefinitions = (definitions || []).filter((def) => {
        const kind = (def as { kind?: string }).kind;
        if (kind) return kind === 'record';
        // Fallback: exclude hierarchy types and known action types
        const name = def.name.toLowerCase();
        return !legacyHierarchyTypes.includes(name) && name !== 'task' && name !== 'subtask';
    });

    const actionDefinitions = (definitions || []).filter((def) => {
        const kind = (def as { kind?: string }).kind;
        if (kind) return kind === 'action_recipe';
        // Fallback: check known action types
        const name = def.name.toLowerCase();
        return name === 'task' || name === 'subtask';
    });

    // Apply search filter
    const filterBySearch = (defs: typeof definitions) =>
        searchQuery.trim()
            ? (defs || []).filter((def) =>
                def.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            : defs || [];

    const filteredRecords = filterBySearch(recordDefinitions);
    const filteredActions = filterBySearch(actionDefinitions);

    const getRecordCount = (definitionId: string): number => {
        if (!stats) return 0;
        const stat = stats.find((s) => s.definitionId === definitionId);
        return stat?.count ?? 0;
    };

    const handleCreateDefinition = (kind: 'record' | 'action_recipe') => {
        openDrawer('create-definition', { kind });
    };

    const handleEditDefinition = (e: React.MouseEvent, definitionId: string) => {
        e.stopPropagation();
        openDrawer('view-definition', { definitionId });
    };

    const renderDefinitionList = (
        defs: typeof definitions,
        section: RegistrySection,
        emptyMessage: string
    ) => {
        if (!defs || defs.length === 0) {
            return (
                <div className="text-center py-4 px-2">
                    <p className="text-xs text-slate-400">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div className="space-y-0.5 px-1">
                {defs.map((def) => {
                    const count = getRecordCount(def.id);
                    const isSelected = selectedDefinitionId === def.id && activeSection === section;
                    const icon = def.styling?.icon;

                    return (
                        <div
                            key={def.id}
                            onClick={() => onSelectDefinition(def.id, section)}
                            className={clsx(
                                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group cursor-pointer',
                                isSelected
                                    ? 'bg-blue-100 text-blue-800'
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
                                    {count} {section === 'records' ? 'record' : 'instance'}{count !== 1 ? 's' : ''}
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

                            {/* Quick create on hover */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (section === 'records') {
                                        openDrawer('create-record', { definitionId: def.id });
                                    } else {
                                        openDrawer('composer', { recipeId: def.id });
                                    }
                                }}
                                className="p-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title={section === 'records' ? `Create ${def.name}` : `Use ${def.name} recipe`}
                            >
                                <Plus size={12} />
                            </button>
                        </div>
                    );
                })}
            </div>
        );
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
                        placeholder="Search types..."
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
                        {/* RECORD TYPES SECTION */}
                        <div className="border-b border-slate-100">
                            <button
                                onClick={() => setRecordsExpanded(!recordsExpanded)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <FolderOpen size={14} className="text-blue-500" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Record Types
                                    </span>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {recordDefinitions.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCreateDefinition('record');
                                        }}
                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Create record type"
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
                                    {renderDefinitionList(filteredRecords, 'records', 'No record types defined')}
                                </div>
                            )}
                        </div>

                        {/* ACTION TYPES SECTION */}
                        <div className="border-b border-slate-100">
                            <button
                                onClick={() => setActionsExpanded(!actionsExpanded)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Zap size={14} className="text-purple-500" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Action Types
                                    </span>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {actionDefinitions.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCreateDefinition('action_recipe');
                                        }}
                                        className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                        title="Create action type"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    {actionsExpanded ? (
                                        <ChevronDown size={14} className="text-slate-400" />
                                    ) : (
                                        <ChevronRight size={14} className="text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {actionsExpanded && (
                                <div className="pb-2">
                                    {renderDefinitionList(filteredActions, 'actions', 'No action types defined')}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Footer Stats */}
            <div className="border-t border-slate-200 px-4 py-3 bg-white">
                <div className="text-xs text-slate-400">
                    {recordDefinitions.length + actionDefinitions.length} types in registry
                </div>
            </div>
        </aside>
    );
}
