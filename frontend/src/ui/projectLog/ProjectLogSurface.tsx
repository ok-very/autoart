/**
 * ProjectLogSurface Component
 *
 * The main Project Log view - displays a chronological event stream for a context.
 * This is the default view for projects.
 *
 * Features:
 * - Context selection (project → process → subprocess)
 * - Paginated event stream (newest first)
 * - Category and system event filtering
 * - Optional grouping by action
 */

import { ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';

import type { ContextType } from '@autoart/shared';

import { type EventCategory, getEventTypesByCategory } from './eventFormatters';
import { ProjectLogEventRow } from './ProjectLogEventRow';
import { ProjectLogFilterBar } from './ProjectLogFilterBar';
import { useProjectTree } from '../../api/hooks';
import { useProjectLogEvents } from '../../api/hooks/projectLog';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import type { HierarchyNode } from '../../types';


const PAGE_SIZE = 50;

/**
 * Collect all subprocesses from a project.
 * Handles both stage-based and stage-less hierarchy structures.
 */
function collectSubprocesses(
  project: HierarchyNode,
  getChildren: (id: string | null) => HierarchyNode[]
): HierarchyNode[] {
  const processes = getChildren(project.id).filter((n) => n.type === 'process');
  const subprocesses: HierarchyNode[] = [];

  for (const process of processes) {
    // Check for subprocesses under stages (legacy/stage-based structure)
    const stages = getChildren(process.id).filter((n) => n.type === 'stage');
    for (const stage of stages) {
      subprocesses.push(...getChildren(stage.id).filter((n) => n.type === 'subprocess'));
    }
    // Also check direct subprocess children (stage-less structure)
    subprocesses.push(...getChildren(process.id).filter((n) => n.type === 'subprocess'));
  }

  return subprocesses;
}

export function ProjectLogSurface() {
  const { activeProjectId, includeSystemEventsInLog } = useUIStore();
  const storeNodes = useHierarchyStore((state) => state.nodes);
  const setNodes = useHierarchyStore((state) => state.setNodes);
  const getNode = useHierarchyStore((state) => state.getNode);
  const getChildren = useHierarchyStore((state) => state.getChildren);

  // Load hierarchy for the active project
  const { data: queryNodes } = useProjectTree(activeProjectId);
  useEffect(() => {
    if (queryNodes) setNodes(queryNodes);
  }, [queryNodes, setNodes]);

  const project = activeProjectId ? getNode(activeProjectId) : null;

  // Collect subprocesses
  const subprocesses = useMemo(() => {
    if (!project) return [];
    return collectSubprocesses(project, getChildren);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, getChildren, storeNodes]);

  // Track selected subprocess for filtering
  const [selectedSubprocessId, setSelectedSubprocessId] = useState<string | null>(null);
  const [isSubprocessDropdownOpen, setIsSubprocessDropdownOpen] = useState(false);

  // Auto-select first subprocess when available
  useEffect(() => {
    if (subprocesses.length > 0 && !selectedSubprocessId) {
      setSelectedSubprocessId(subprocesses[0].id);
    }
  }, [subprocesses, selectedSubprocessId]);

  const selectedSubprocess = selectedSubprocessId ? getNode(selectedSubprocessId) : null;

  // Local filter state
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>([]);
  const [groupByAction, setGroupByAction] = useState(false);
  const [page, setPage] = useState(0);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedSubprocessId, selectedCategories, includeSystemEventsInLog]);

  // Convert selected categories to event types
  const selectedTypes = useMemo(() => {
    if (selectedCategories.length === 0) return undefined;
    return selectedCategories.flatMap((cat) => getEventTypesByCategory(cat));
  }, [selectedCategories]);

  // Determine context for query
  const contextId = selectedSubprocessId || activeProjectId;
  const contextType: ContextType = selectedSubprocessId ? 'subprocess' : 'project';

  // Fetch events
  const {
    data: eventsData,
    isLoading,
    isError,
    refetch,
  } = useProjectLogEvents({
    contextId,
    contextType,
    includeSystem: includeSystemEventsInLog,
    types: selectedTypes,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const events = eventsData?.events || [];
  const total = eventsData?.total || 0;
  const hasMore = eventsData?.hasMore || false;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Filter handlers
  const handleCategoryToggle = useCallback((category: EventCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedCategories([]);
  }, []);

  const handleGroupByActionToggle = useCallback(() => {
    setGroupByAction((prev) => !prev);
  }, []);

  // Pagination handlers
  const handlePrevPage = useCallback(() => {
    setPage((p) => Math.max(0, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (hasMore) {
      setPage((p) => p + 1);
    }
  }, [hasMore]);

  // Loading state
  if (!activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
        <div className="text-center">
          <p className="text-lg font-medium">No project selected</p>
          <p className="text-sm">Select a project from the top menu</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Project Log
            </div>
            {/* Subprocess dropdown */}
            {subprocesses.length > 0 ? (
              <div className="relative">
                <button
                  onClick={() => setIsSubprocessDropdownOpen(!isSubprocessDropdownOpen)}
                  className="flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                >
                  <span className="truncate max-w-[200px]" title={selectedSubprocess?.title || 'All'}>
                    {selectedSubprocess?.title || 'Select subprocess'}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 transition-transform ${isSubprocessDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isSubprocessDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsSubprocessDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase">
                        Subprocesses
                      </div>
                      {subprocesses.map((sp) => (
                        <button
                          key={sp.id}
                          onClick={() => {
                            setSelectedSubprocessId(sp.id);
                            setIsSubprocessDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${sp.id === selectedSubprocessId
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-700'
                            }`}
                        >
                          <span className="truncate block" title={sp.title}>
                            {sp.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm font-semibold text-slate-800 truncate">
                {project.title}
              </div>
            )}
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter bar */}
      <ProjectLogFilterBar
        selectedCategories={selectedCategories}
        onCategoryToggle={handleCategoryToggle}
        onClearFilters={handleClearFilters}
        groupByAction={groupByAction}
        onGroupByActionToggle={handleGroupByActionToggle}
        totalEvents={total}
      />

      {/* Event stream */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 px-4">
          {isLoading && events.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : (isError || events.length === 0) ? (
            <div className="text-center py-12">
              {selectedCategories.length > 0 ? (
                <>
                  <p className="font-medium text-slate-400">No events found</p>
                  <p className="text-sm mt-1 text-slate-400">Try adjusting your filters</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                    <span className="text-2xl">📋</span>
                  </div>
                  <p className="font-medium text-slate-600">No actions yet</p>
                  <p className="text-sm mt-1 text-slate-400 max-w-xs mx-auto">
                    Get started by creating your first action or using an existing action recipe.
                  </p>
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={() => useUIStore.getState().openDrawer('composer', { contextId: selectedSubprocessId })}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-violet-600 hover:to-purple-700 shadow-sm transition-all"
                    >
                      <span>✨</span>
                      Create Action
                    </button>
                    <button
                      onClick={() => useUIStore.getState().openDrawer('template-library')}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      <span>📚</span>
                      Browse Action Recipes
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-4">
                    Or go to{' '}
                    <a href="/records" className="text-blue-600 hover:underline">
                      Records
                    </a>
                    {' '}to manage action recipes
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Timeline container */}
              <div className="relative">
                {/* Vertical timeline line */}
                <div
                  className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-slate-200 -z-10"
                  aria-hidden="true"
                />

                {/* Event rows */}
                {events.map((event, index) => (
                  <ProjectLogEventRow
                    key={event.id}
                    event={event}
                    isLast={index === events.length - 1}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-200">
                  <button
                    onClick={handlePrevPage}
                    disabled={page === 0}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                    Newer
                  </button>
                  <span className="text-sm text-slate-500">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={!hasMore}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Older
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* End marker */}
              {!hasMore && events.length > 0 && (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-300 pt-6">
                  <div className="h-px w-10 bg-slate-200" />
                  <span>End of log</span>
                  <div className="h-px w-10 bg-slate-200" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
