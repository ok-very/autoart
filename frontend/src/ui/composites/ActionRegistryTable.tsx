/**
 * ActionRegistryTable - Radix-styled action data grid
 *
 * A clean, hierarchical table for displaying workflow actions.
 * Follows Radix UI design patterns with:
 * - Sticky header with sorting
 * - Row selection and hover states
 * - Inline status editing
 * - Expandable nested rows
 * - Context menu per row
 */

import { clsx } from 'clsx';
import {
  ChevronRight,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Clock,
  XCircle,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Download,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import type { WorkflowSurfaceNode, DerivedStatus } from '@autoart/shared';

import { buildChildrenMap } from '../../api/hooks/workflowSurface';
import { StatusFieldEditor } from '../semantic/StatusFieldEditor';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from '@autoart/ui';

// ==================== TYPES ====================

export interface ActionRegistryTableProps {
  /** Workflow surface nodes from projection */
  nodes: WorkflowSurfaceNode[];
  /** Currently selected action ID */
  selectedActionId?: string | null;
  /** Callback when an action row is clicked */
  onRowSelect?: (actionId: string) => void;
  /** Callback when a field value changes */
  onFieldChange?: (actionId: string, fieldKey: string, value: unknown) => void;
  /** Callback when status changes */
  onStatusChange?: (actionId: string, status: DerivedStatus) => void;
  /** Callback to add a new action */
  onAddAction?: () => void;
  /** Callback for row menu actions */
  onRowAction?: (actionId: string, action: 'view' | 'edit' | 'history' | 'retract') => void;
  /** Context label (e.g., subprocess name) */
  contextLabel?: string;
  /** Status configuration for display */
  statusConfig?: Record<DerivedStatus, { label: string; colorClass: string }>;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional className */
  className?: string;
}

// Default status configuration with Radix-style colors
const DEFAULT_STATUS_CONFIG: Record<DerivedStatus, { label: string; colorClass: string }> = {
  pending: { label: 'Pending', colorClass: 'bg-slate-100 text-slate-600 border-slate-200' },
  active: { label: 'Active', colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  blocked: { label: 'Blocked', colorClass: 'bg-red-50 text-red-700 border-red-200' },
  finished: { label: 'Done', colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

// ==================== HELPERS ====================

function flattenTree(
  childrenMap: Map<string | null, WorkflowSurfaceNode[]>,
  expandedIds: Set<string>
): { node: WorkflowSurfaceNode; visible: boolean; depth: number }[] {
  const result: { node: WorkflowSurfaceNode; visible: boolean; depth: number }[] = [];

  function addNode(node: WorkflowSurfaceNode, depth: number, ancestorCollapsed: boolean) {
    const visible = !ancestorCollapsed;
    result.push({ node, visible, depth });

    const children = childrenMap.get(node.actionId) || [];
    const isExpanded = expandedIds.has(node.actionId);
    const childCollapsed = ancestorCollapsed || !isExpanded;

    for (const child of children) {
      addNode(child, depth + 1, childCollapsed);
    }
  }

  const roots = childrenMap.get(null) || [];
  for (const root of roots) {
    addNode(root, 0, false);
  }

  return result;
}

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// ==================== SUBCOMPONENTS ====================

interface StatusBadgeProps {
  status: DerivedStatus;
  config: Record<DerivedStatus, { label: string; colorClass: string }>;
}

function StatusBadge({ status, config }: StatusBadgeProps) {
  const { label, colorClass } = config[status] || config.pending;
  return (
    <span
      className={clsx(
        'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium border',
        colorClass
      )}
    >
      {label}
    </span>
  );
}

// AssigneeChipGroup is imported from atoms - supports multiple assignees
import { AssigneeChipGroup } from '../atoms/AssigneeChipGroup';

// ==================== MAIN COMPONENT ====================

export function ActionRegistryTable({
  nodes,
  selectedActionId,
  onRowSelect,
  onFieldChange: _onFieldChange,
  onStatusChange,
  onAddAction,
  onRowAction,
  contextLabel,
  statusConfig = DEFAULT_STATUS_CONFIG,
  emptyMessage = 'No actions yet. Use Composer to declare one.',
  className,
}: ActionRegistryTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');

  // Build children map for O(1) lookup
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes]);

  // Flatten tree with visibility
  const flattenedNodes = useMemo(
    () => flattenTree(childrenMap, expandedIds),
    [childrenMap, expandedIds]
  );

  // Filter visible nodes
  const visibleNodes = useMemo(() => {
    let filtered = flattenedNodes.filter((n) => n.visible);

    if (filterText.trim()) {
      const search = filterText.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.node.payload.title?.toLowerCase().includes(search) ||
          n.node.payload.assignee?.name?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [flattenedNodes, filterText]);

  const handleToggleExpanded = useCallback((actionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  }, []);

  if (nodes.length === 0) {
    return (
      <div className={clsx('flex flex-col h-full', className)}>
        <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">{emptyMessage}</p>
            {onAddAction && (
              <button
                onClick={onAddAction}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
              >
                <Plus size={14} />
                New Action
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter actions..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-56 transition-shadow"
            />
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <button className="h-8 px-3 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md flex items-center gap-1.5 transition-colors">
            <SlidersHorizontal size={14} />
            View: All
          </button>
          <button className="h-8 px-3 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md flex items-center gap-1.5 transition-colors">
            <ArrowUpDown size={14} />
            Sort
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 bg-white rounded-md flex items-center gap-1.5 transition-colors">
            <Download size={14} />
            Export
          </button>
          {onAddAction && (
            <button
              onClick={onAddAction}
              className="h-8 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} />
              New Action
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="bg-slate-50 border-b border-slate-200 px-4 h-10 text-left font-medium text-slate-500 sticky top-0 z-10 w-10">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="bg-slate-50 border-b border-slate-200 px-4 h-10 text-left font-medium text-slate-500 sticky top-0 z-10 w-28">
                Action ID
              </th>
              <th className="bg-slate-50 border-b border-slate-200 px-4 h-10 text-left font-medium text-slate-500 sticky top-0 z-10 min-w-[240px]">
                Intent (Title)
              </th>
              <th className="bg-slate-50 border-b border-slate-200 px-4 h-10 text-left font-medium text-slate-500 sticky top-0 z-10 w-28">
                Status
              </th>
              <th className="bg-slate-50 border-b border-slate-200 px-4 h-10 text-left font-medium text-slate-500 sticky top-0 z-10 w-32">
                Assignee
              </th>
              <th className="bg-slate-50 border-b border-slate-200 px-4 h-10 text-left font-medium text-slate-500 sticky top-0 z-10 w-36">
                Context
              </th>
              <th className="bg-slate-50 border-b border-slate-200 px-4 h-10 text-right font-medium text-slate-500 sticky top-0 z-10 w-20">
                Events
              </th>
              <th className="bg-slate-50 border-b border-slate-200 px-4 h-10 text-left font-medium text-slate-500 sticky top-0 z-10 w-32">
                Last Updated
              </th>
              <th className="bg-slate-50 border-b border-slate-200 px-2 h-10 sticky top-0 z-10 w-10" />
            </tr>
          </thead>
          <tbody>
            {visibleNodes.map(({ node, depth }) => {
              const hasChildren = node.flags?.hasChildren ?? false;
              const isExpanded = expandedIds.has(node.actionId);
              const isSelected = node.actionId === selectedActionId;
              const indentPx = depth * 20;

              return (
                <tr
                  key={node.actionId}
                  onClick={() => onRowSelect?.(node.actionId)}
                  className={clsx(
                    'group cursor-pointer transition-colors',
                    isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  )}
                >
                  {/* Checkbox */}
                  <td className="border-b border-slate-100 px-4 h-11">
                    <input
                      type="checkbox"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>

                  {/* Action ID */}
                  <td className="border-b border-slate-100 px-4 h-11">
                    <span className="font-mono text-xs text-slate-400">
                      {node.actionId.slice(0, 12)}
                    </span>
                  </td>

                  {/* Title with indent */}
                  <td className="border-b border-slate-100 px-4 h-11">
                    <div className="flex items-center gap-1" style={{ paddingLeft: `${indentPx}px` }}>
                      {hasChildren && (
                        <button
                          onClick={(e) => handleToggleExpanded(node.actionId, e)}
                          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 shrink-0"
                        >
                          <ChevronRight
                            size={14}
                            className={clsx('transition-transform', isExpanded && 'rotate-90')}
                          />
                        </button>
                      )}
                      {!hasChildren && depth === 0 && <div className="w-5 shrink-0" />}
                      {depth > 0 && !hasChildren && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 ml-1.5 mr-1" />
                      )}
                      <span className="font-medium text-slate-900 truncate">
                        {node.payload.title || 'Untitled'}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="border-b border-slate-100 px-4 h-11" onClick={(e) => e.stopPropagation()}>
                    {onStatusChange ? (
                      <StatusFieldEditor
                        value={node.payload.status as DerivedStatus}
                        statusConfig={statusConfig}
                        onChange={(val) => onStatusChange(node.actionId, val as DerivedStatus)}
                        compact
                      />
                    ) : (
                      <StatusBadge status={node.payload.status as DerivedStatus} config={statusConfig} />
                    )}
                  </td>

                  {/* Assignee */}
                  <td className="border-b border-slate-100 px-4 h-11">
                    <AssigneeChipGroup assignees={node.payload.assignees} showNames size="sm" />
                  </td>

                  {/* Context */}
                  <td className="border-b border-slate-100 px-4 h-11">
                    <span className="text-xs text-slate-500">{contextLabel || '—'}</span>
                  </td>

                  {/* Events count */}
                  <td className="border-b border-slate-100 px-4 h-11 text-right">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-white text-xs font-mono text-slate-500">
                      {String((node.flags as Record<string, unknown>)?.eventCount ?? 0)}
                    </span>
                  </td>

                  {/* Last Updated */}
                  <td className="border-b border-slate-100 px-4 h-11">
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime((node.payload as Record<string, unknown>).updatedAt as string | undefined)}
                    </span>
                  </td>

                  {/* Menu */}
                  <td className="border-b border-slate-100 px-2 h-11">
                    <Dropdown>
                      <DropdownTrigger
                        onClick={(e) => e.stopPropagation()}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        <MoreHorizontal size={16} />
                      </DropdownTrigger>
                      <DropdownContent align="end" className="w-44">
                        <DropdownLabel>Actions</DropdownLabel>
                        <DropdownItem onSelect={() => onRowAction?.(node.actionId, 'view')}>
                          <Eye size={14} className="mr-2" />
                          View Details
                        </DropdownItem>
                        <DropdownItem onSelect={() => onRowAction?.(node.actionId, 'edit')}>
                          <Pencil size={14} className="mr-2" />
                          Amend Intent
                        </DropdownItem>
                        <DropdownItem onSelect={() => onRowAction?.(node.actionId, 'history')}>
                          <Clock size={14} className="mr-2" />
                          View History
                        </DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem
                          onSelect={() => onRowAction?.(node.actionId, 'retract')}
                          className="text-red-600 focus:bg-red-50 focus:text-red-700"
                        >
                          <XCircle size={14} className="mr-2" />
                          Retract
                        </DropdownItem>
                      </DropdownContent>
                    </Dropdown>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ActionRegistryTable;
