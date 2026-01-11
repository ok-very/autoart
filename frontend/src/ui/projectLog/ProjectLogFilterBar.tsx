/**
 * ProjectLogFilterBar
 *
 * Filter controls for the Project Log view.
 *
 * Features:
 * - Category filter chips (Workflow, Fields, Assignments, etc.)
 * - "Include system events" toggle (persisted in uiStore)
 * - Optional "Group by Action" toggle
 */

import { clsx } from 'clsx';
import { Eye, EyeOff, Layers } from 'lucide-react';

import { EVENT_CATEGORIES, type EventCategory } from './eventFormatters';
import { useUIStore } from '../../stores/uiStore';

interface ProjectLogFilterBarProps {
  /** Currently selected categories (empty = all) */
  selectedCategories: EventCategory[];
  /** Toggle a category filter */
  onCategoryToggle: (category: EventCategory) => void;
  /** Clear all category filters */
  onClearFilters: () => void;
  /** Whether grouping by action is enabled */
  groupByAction: boolean;
  /** Toggle group by action */
  onGroupByActionToggle: () => void;
  /** Total event count (for display) */
  totalEvents?: number;
}

export function ProjectLogFilterBar({
  selectedCategories,
  onCategoryToggle,
  onClearFilters,
  groupByAction,
  onGroupByActionToggle,
  totalEvents,
}: ProjectLogFilterBarProps) {
  const { includeSystemEventsInLog, setIncludeSystemEventsInLog } = useUIStore();

  const hasActiveFilters = selectedCategories.length > 0;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 bg-white border-b border-slate-200">
      {/* Left: Category chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium">Filter:</span>

        {EVENT_CATEGORIES.filter((cat) => cat.value !== 'system').map((category) => {
          const isSelected = selectedCategories.includes(category.value);
          return (
            <button
              key={category.value}
              onClick={() => onCategoryToggle(category.value)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                isSelected
                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {category.label}
            </button>
          );
        })}

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Right: Toggles */}
      <div className="flex items-center gap-3">
        {/* Event count */}
        {totalEvents !== undefined && (
          <span className="text-xs text-slate-400 font-mono">
            {totalEvents} event{totalEvents !== 1 ? 's' : ''}
          </span>
        )}

        {/* Group by action toggle */}
        <button
          onClick={onGroupByActionToggle}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors',
            groupByAction
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          )}
          title={groupByAction ? 'Grouped by action' : 'Chronological order'}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Group</span>
        </button>

        {/* System events toggle */}
        <button
          onClick={() => setIncludeSystemEventsInLog(!includeSystemEventsInLog)}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors',
            includeSystemEventsInLog
              ? 'bg-slate-200 text-slate-700'
              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          )}
          title={includeSystemEventsInLog ? 'System events visible' : 'System events hidden'}
        >
          {includeSystemEventsInLog ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">System</span>
        </button>
      </div>
    </div>
  );
}
