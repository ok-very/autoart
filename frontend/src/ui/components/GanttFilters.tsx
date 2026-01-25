/**
 * GanttFilters
 *
 * Filter controls for the Gantt timeline view.
 * Allows filtering by status, assignee, date range, and search.
 */

import { useState, useMemo } from 'react';
import { Search, Filter, X, Calendar, User, CircleDot } from 'lucide-react';
import type { TimelineFilter } from '../../utils/timeline-mapper';

interface GanttFiltersProps {
    /** Current filter state */
    filter: TimelineFilter;
    /** Callback when filter changes */
    onFilterChange: (filter: TimelineFilter) => void;
    /** Available statuses for dropdown */
    availableStatuses: string[];
    /** Available assignees for dropdown */
    availableAssignees: string[];
    /** Date range bounds */
    dateRange?: { min: Date | null; max: Date | null };
}

export function GanttFilters({
    filter,
    onFilterChange,
    availableStatuses,
    availableAssignees,
    dateRange,
}: GanttFiltersProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filter.statuses && filter.statuses.length > 0) count++;
        if (filter.assignees && filter.assignees.length > 0) count++;
        if (filter.dateRange?.start || filter.dateRange?.end) count++;
        if (filter.search) count++;
        return count;
    }, [filter]);

    const handleSearchChange = (value: string) => {
        onFilterChange({ ...filter, search: value || undefined });
    };

    const handleStatusToggle = (status: string) => {
        const current = filter.statuses || [];
        const updated = current.includes(status)
            ? current.filter(s => s !== status)
            : [...current, status];
        onFilterChange({ ...filter, statuses: updated.length > 0 ? updated : undefined });
    };

    const handleAssigneeToggle = (assignee: string) => {
        const current = filter.assignees || [];
        const updated = current.includes(assignee)
            ? current.filter(a => a !== assignee)
            : [...current, assignee];
        onFilterChange({ ...filter, assignees: updated.length > 0 ? updated : undefined });
    };

    const handleGroupByChange = (groupBy: TimelineFilter['groupBy']) => {
        onFilterChange({ ...filter, groupBy });
    };

    const handleClearAll = () => {
        onFilterChange({});
    };

    return (
        <div className="space-y-3">
            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search items..."
                    value={filter.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {/* Filter Toggle */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-800 w-full"
            >
                <Filter size={14} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full">
                        {activeFilterCount}
                    </span>
                )}
            </button>

            {/* Expanded Filters */}
            {isExpanded && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                    {/* Group By */}
                    <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                            Group By
                        </label>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {(['parent', 'status', 'assignee', 'type'] as const).map(option => (
                                <button
                                    key={option}
                                    onClick={() => handleGroupByChange(option)}
                                    className={`px-2 py-1 text-[10px] rounded ${
                                        (filter.groupBy || 'parent') === option
                                            ? 'bg-blue-100 text-blue-700 font-medium'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {option === 'parent' ? 'Parent' : option.charAt(0).toUpperCase() + option.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status Filter */}
                    {(availableStatuses?.length ?? 0) > 0 && (
                        <div>
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                <CircleDot size={10} />
                                Status
                            </label>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                {(availableStatuses ?? []).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => handleStatusToggle(status)}
                                        className={`px-2 py-1 text-[10px] rounded transition-colors ${
                                            filter.statuses?.includes(status)
                                                ? 'bg-blue-100 text-blue-700 font-medium'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {formatLabel(status)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Assignee Filter */}
                    {(availableAssignees?.length ?? 0) > 0 && (
                        <div>
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                <User size={10} />
                                Assignee
                            </label>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                {(availableAssignees ?? []).map(assignee => (
                                    <button
                                        key={assignee}
                                        onClick={() => handleAssigneeToggle(assignee)}
                                        className={`px-2 py-1 text-[10px] rounded transition-colors ${
                                            filter.assignees?.includes(assignee)
                                                ? 'bg-blue-100 text-blue-700 font-medium'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {assignee}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Clear All */}
                    {activeFilterCount > 0 && (
                        <button
                            onClick={handleClearAll}
                            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700"
                        >
                            <X size={12} />
                            Clear all filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function formatLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default GanttFilters;
