import { clsx } from 'clsx';
import { Plus, FolderOpen, Search, Settings } from 'lucide-react';
import { useState } from 'react';

import { useRecordDefinitions, useRecordStats } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';

interface RecordTypeSidebarProps {
  width: number;
  selectedDefinitionId: string | null;
  onSelectDefinition: (id: string | null) => void;
}

/**
 * Left sidebar showing available record definition types.
 * Displays each type with emoji icon, name, and record count.
 *
 * Filtering logic:
 * - Shows only definitions with kind='record' (data definitions)
 * - Excludes kind='action_arrangement' (Task, etc.) which belong in Composer
 * - Also excludes legacy hierarchy node types by name as fallback
 */
export function RecordTypeSidebar({
  width,
  selectedDefinitionId,
  onSelectDefinition,
}: RecordTypeSidebarProps) {
  const { data: definitions, isLoading } = useRecordDefinitions();
  const { data: stats } = useRecordStats();
  const { openOverlay } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter to show only data definitions (kind='record')
  // Exclude action recipes and legacy hierarchy node types
  const legacyHierarchyTypes = ['project', 'process', 'stage', 'subprocess'];

  const recordDefinitions = (definitions || []).filter((def) => {
    // If kind is available, use it as the primary discriminator
    const kind = (def as { kind?: string }).kind;
    if (kind) {
      return kind === 'record';
    }
    // Fallback: exclude legacy hierarchy types by name
    return !legacyHierarchyTypes.includes(def.name.toLowerCase());
  });

  const filteredDefinitions = searchQuery.trim()
    ? recordDefinitions.filter((def) =>
      def.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : recordDefinitions;

  const getRecordCount = (definitionId: string): number => {
    if (!stats) return 0;
    const stat = stats.find((s) => s.definitionId === definitionId);
    return stat?.count ?? 0;
  };

  const handleCreateDefinition = () => {
    openOverlay('create-definition');
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
      <div className="h-10 border-b border-slate-200 flex items-center justify-between px-3 bg-white">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} className="text-slate-500" />
          <span className="font-semibold text-slate-700">Record Types</span>
        </div>
        <button
          onClick={handleCreateDefinition}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Create new definition"
        >
          <Plus size={18} />
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
            placeholder="Search types..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* "All Records" option */}
      <div className="px-2 pt-2">
        <button
          onClick={() => onSelectDefinition(null)}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
            selectedDefinitionId === null
              ? 'bg-blue-100 text-blue-800'
              : 'hover:bg-slate-100 text-slate-600'
          )}
        >
          <span className="text-lg">📋</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">All Records</div>
            <div className="text-xs text-slate-400">
              {stats ? stats.reduce((sum, s) => sum + s.count, 0) : 0} total
            </div>
          </div>
        </button>
      </div>

      {/* Definition List */}
      <div className="flex-1 overflow-y-auto custom-scroll px-2 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full" />
          </div>
        ) : filteredDefinitions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">
              {searchQuery ? 'No matching types' : 'No record types defined'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateDefinition}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Create your first type
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredDefinitions.map((def) => {
              const count = getRecordCount(def.id);
              const isSelected = selectedDefinitionId === def.id;
              const icon = def.styling?.icon;
              const color = def.styling?.color || 'slate';

              return (
                <div
                  key={def.id}
                  onClick={() => onSelectDefinition(def.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group cursor-pointer',
                    isSelected
                      ? `bg-${color}-100 text-${color}-800`
                      : 'hover:bg-slate-100 text-slate-600'
                  )}
                  style={{
                    backgroundColor: isSelected
                      ? `var(--tw-color-${color}-100, #f1f5f9)`
                      : undefined,
                  }}
                >
                  {/* Icon */}
                  <span className="text-lg shrink-0">
                    {icon || def.name.charAt(0).toUpperCase()}
                  </span>

                  {/* Name and Count */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{def.name}</div>
                    <div className="text-xs text-slate-400">
                      {count} record{count !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Edit Schema button on hover */}
                  <button
                    onClick={(e) => handleEditDefinition(e, def.id)}
                    className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Edit ${def.name} schema`}
                  >
                    <Settings size={14} />
                  </button>

                  {/* Quick create action on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openOverlay('create-record', { definitionId: def.id });
                    }}
                    className="p-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Create new ${def.name}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="border-t border-slate-200 px-4 py-3 bg-white">
        <div className="text-xs text-slate-400">
          {recordDefinitions.length} type{recordDefinitions.length !== 1 ? 's' : ''} available
        </div>
      </div>
    </aside>
  );
}
