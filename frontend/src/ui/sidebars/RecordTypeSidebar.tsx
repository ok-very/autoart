import { clsx } from 'clsx';
import { Plus, FolderOpen, Settings } from 'lucide-react';
import { useState } from 'react';

import { useRecordDefinitions, useRecordStats } from '../../api/hooks';
import { useListFilter } from '../../hooks/useListFilter';
import { useUIStore } from '../../stores/uiStore';
import { FilterBar, Spinner } from '@autoart/ui';

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

  // Filter to show only data definitions — definition_kind is authoritative
  const recordDefinitions = (definitions || []).filter((def) => {
    const defKind = (def as { definition_kind?: string }).definition_kind;
    return defKind === 'record';
  });

  const filteredDefinitions = useListFilter(recordDefinitions, searchQuery, {
    keys: ['name'],
    sortFn: (a, b) => a.name.localeCompare(b.name),
  });

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
      className="bg-ws-bg border-r border-ws-panel-border flex flex-col shrink-0"
      style={{ width }}
    >
      {/* Header */}
      <div className="h-10 border-b border-ws-panel-border flex items-center justify-between px-3 bg-ws-panel-bg">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} className="text-ws-text-secondary" />
          <span className="font-semibold text-ws-text-secondary">Record Types</span>
        </div>
        <button
          onClick={handleCreateDefinition}
          className="p-1.5 text-ws-text-secondary hover:bg-ws-row-expanded-bg rounded-lg transition-colors"
          title="Create new definition"
        >
          <Plus size={18} />
        </button>
      </div>

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        resultCount={filteredDefinitions.length}
        placeholder="Filter record types..."
      />

      {/* "All Records" option */}
      <div className="px-2 pt-2">
        <button
          onClick={() => onSelectDefinition(null)}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
            selectedDefinitionId === null
              ? 'bg-ws-row-expanded-bg text-ws-fg'
              : 'hover:bg-ws-row-expanded-bg text-ws-text-secondary'
          )}
        >
          <span className="text-lg">📋</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">All Records</div>
            <div className="text-xs text-ws-muted">
              {stats ? stats.reduce((sum, s) => sum + s.count, 0) : 0} total
            </div>
          </div>
        </button>
      </div>

      {/* Definition List */}
      <div className="flex-1 overflow-y-auto custom-scroll px-2 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : filteredDefinitions.length === 0 ? (
          <div className="py-8 px-4">
            <p className="text-xs text-ws-text-secondary">
              {searchQuery ? `0 of ${recordDefinitions.length} types` : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredDefinitions.map((def) => {
              const count = getRecordCount(def.id);
              const isSelected = selectedDefinitionId === def.id;
              const icon = def.styling?.icon;

              return (
                <div
                  key={def.id}
                  onClick={() => onSelectDefinition(def.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group cursor-pointer',
                    isSelected
                      ? 'bg-ws-row-expanded-bg text-ws-fg'
                      : 'hover:bg-ws-row-expanded-bg text-ws-text-secondary'
                  )}
                >
                  {/* Icon */}
                  <span className="text-lg shrink-0">
                    {icon || def.name.charAt(0).toUpperCase()}
                  </span>

                  {/* Name and Count */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{def.name}</div>
                    <div className="text-xs text-ws-muted">
                      {count} record{count !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Edit Schema button on hover */}
                  <button
                    onClick={(e) => handleEditDefinition(e, def.id)}
                    className="p-1 text-ws-muted hover:text-ws-text-secondary hover:bg-ws-row-expanded-bg rounded opacity-0 group-hover:opacity-100 transition-opacity"
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
                    className="p-1 text-ws-muted hover:text-ws-fg hover:bg-ws-row-expanded-bg rounded opacity-0 group-hover:opacity-100 transition-opacity"
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
      <div className="border-t border-ws-panel-border px-4 py-3 bg-ws-panel-bg">
        <div className="text-xs text-ws-muted">
          {recordDefinitions.length} type{recordDefinitions.length !== 1 ? 's' : ''} available
        </div>
      </div>
    </aside>
  );
}
