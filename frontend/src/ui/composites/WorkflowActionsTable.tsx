/**
 * WorkflowActionsTable - Table for workflow surface nodes (recursive prerequisites)
 *
 * This component renders WorkflowSurfaceNode[] from the materialized projection.
 * It supports recursive nesting where:
 * - Parent = blocked action (the action that depends on others)
 * - Children = prerequisites (the actions that must complete first)
 *
 * Features:
 * - Recursive tree structure with expand/collapse
 * - O(1) child lookup via precomputed map
 * - Inline editing via work events
 * - Status display from pre-computed payload
 * - Cycle detection flags
 *
 * Architecture:
 * - Uses UniversalTableCore for rendering
 * - Builds row model from flat WorkflowSurfaceNode[] with parent-child relationships
 * - Status/title/assignee come from pre-computed payload (no interpretation at render)
 */

import { clsx } from 'clsx';
import { ChevronRight, Plus, AlertTriangle } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import type { WorkflowSurfaceNode, DerivedStatus } from '@autoart/shared';
import type { FieldViewModel } from '@autoart/shared/domain';

import { buildChildrenMap } from '../../api/hooks/workflowSurface';
import { EditableCell } from '../../ui/molecules/EditableCell';
import { StatusFieldEditor } from '../semantic/StatusFieldEditor';
import { UniversalTableCore, type TableColumn as CoreTableColumn, type TableRow, type RowModel } from '../table-core';



// ==================== TYPES ====================

export interface WorkflowActionsTableProps {
  /** Workflow surface nodes from projection */
  nodes: WorkflowSurfaceNode[];
  /** Currently selected action ID */
  selectedActionId?: string | null;
  /** Callback when an action row is clicked */
  onRowSelect?: (actionId: string) => void;
  /** Callback when a field value changes (emits event via parent) */
  onFieldChange?: (actionId: string, fieldKey: string, value: unknown) => void;
  /** Callback when status changes (emits work event via parent) */
  onStatusChange?: (actionId: string, status: DerivedStatus) => void;
  /** Callback to add a new action */
  onAddAction?: () => void;
  /** Status configuration for display */
  statusConfig?: Record<DerivedStatus, { label: string; colorClass: string }>;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional className */
  className?: string;
}

// Default status configuration
const DEFAULT_STATUS_CONFIG: Record<DerivedStatus, { label: string; colorClass: string }> = {
  pending: { label: 'Pending', colorClass: 'bg-slate-400' },
  active: { label: 'Active', colorClass: 'bg-blue-500' },
  blocked: { label: 'Blocked', colorClass: 'bg-amber-500' },
  finished: { label: 'Finished', colorClass: 'bg-green-500' },
};

// ==================== HELPERS ====================

/**
 * Flatten surface nodes into a list with proper ordering for tree display.
 * Uses DFS to ensure children appear directly after their parent.
 */
function flattenTree(
  childrenMap: Map<string | null, WorkflowSurfaceNode[]>,
  expandedIds: Set<string>
): { node: WorkflowSurfaceNode; visible: boolean }[] {
  const result: { node: WorkflowSurfaceNode; visible: boolean }[] = [];

  function addNode(node: WorkflowSurfaceNode, ancestorCollapsed: boolean) {
    const visible = !ancestorCollapsed;
    result.push({ node, visible });

    const children = childrenMap.get(node.actionId) || [];
    const isExpanded = expandedIds.has(node.actionId);
    const childCollapsed = ancestorCollapsed || !isExpanded;

    for (const child of children) {
      addNode(child, childCollapsed);
    }
  }

  // Start with root nodes (parentActionId === null)
  const roots = childrenMap.get(null) || [];
  for (const root of roots) {
    addNode(root, false);
  }

  return result;
}

// ==================== COMPONENT ====================

export function WorkflowActionsTable({
  nodes,
  selectedActionId,
  onRowSelect,
  onFieldChange,
  onStatusChange,
  onAddAction,
  statusConfig = DEFAULT_STATUS_CONFIG,
  emptyMessage = 'No actions found',
  className,
}: WorkflowActionsTableProps) {
  // Track which nodes are expanded (show children)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Build children map for O(1) lookup
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes]);

  // Flatten tree with visibility based on expanded state
  const flattenedNodes = useMemo(
    () => flattenTree(childrenMap, expandedIds),
    [childrenMap, expandedIds]
  );

  // Filter to only visible nodes for rendering
  const visibleNodes = useMemo(
    () => flattenedNodes.filter((n) => n.visible).map((n) => n.node),
    [flattenedNodes]
  );

  // Handle expand/collapse toggle
  const handleToggleExpanded = useCallback((actionId: string) => {
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

  // Build FieldViewModel for title editing
  const buildTitleViewModel = useCallback(
    (node: WorkflowSurfaceNode): FieldViewModel => ({
      fieldId: 'title',
      label: 'Title',
      type: 'text',
      value: node.payload.title,
      editable: true,
      visible: true,
      required: true,
      placeholder: 'Enter title...',
    }),
    []
  );

  // Build row model for UniversalTableCore
  const rowModel: RowModel = useMemo(() => {
    const rows: TableRow[] = visibleNodes.map((node) => {
      const hasChildren = node.flags?.hasChildren ?? false;
      const isExpanded = expandedIds.has(node.actionId);

      return {
        id: node.actionId,
        data: node,
        meta: {
          depth: node.depth,
          hasChildren,
          isExpanded,
          parentId: node.parentActionId,
          cycleDetected: node.flags?.cycleDetected ?? false,
        },
      };
    });

    const rowMap = new Map(rows.map((r) => [r.id, r]));

    return {
      getRows: () => rows,
      getRowById: (id) => rowMap.get(id),
      capabilities: { selectable: true, expandable: true },
      isExpanded: (id) => expandedIds.has(id),
      toggleExpanded: handleToggleExpanded,
    };
  }, [visibleNodes, expandedIds, handleToggleExpanded]);

  // Define columns
  const columns = useMemo<CoreTableColumn[]>(() => {
    const cols: CoreTableColumn[] = [];

    // Title column with indent and chevron
    cols.push({
      id: 'title',
      header: 'Title',
      width: 320,
      minWidth: 200,
      resizable: true,
      sortKey: (row: TableRow) => {
        const node = row.data as WorkflowSurfaceNode;
        return node.payload.title || '';
      },
      cell: (row: TableRow) => {
        const node = row.data as WorkflowSurfaceNode;
        const depth = (row.meta?.depth as number) || 0;
        const hasChildren = (row.meta?.hasChildren as boolean) || false;
        const isExpanded = (row.meta?.isExpanded as boolean) || false;
        const cycleDetected = (row.meta?.cycleDetected as boolean) || false;
        const indentPx = depth * 24;

        return (
          <div
            className="flex items-center gap-1"
            style={{ paddingLeft: `${indentPx}px` }}
          >
            {/* Chevron for expandable nodes */}
            {hasChildren && (
              <button
                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleExpanded(node.actionId);
                }}
              >
                <ChevronRight
                  size={14}
                  className={clsx('transition-transform', isExpanded && 'rotate-90')}
                />
              </button>
            )}
            {/* Spacer when no children at root */}
            {!hasChildren && depth === 0 && <div className="w-5 shrink-0" />}
            {/* Nested indicator dot */}
            {depth > 0 && !hasChildren && (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 ml-1" />
            )}
            {/* Cycle warning */}
            {cycleDetected && (
              <span
                className="text-amber-500 shrink-0"
                title="Circular dependency detected"
              >
                <AlertTriangle size={14} />
              </span>
            )}
            {/* Title */}
            <div className="flex-1 min-w-0">
              <EditableCell
                viewModel={buildTitleViewModel(node)}
                onSave={(_fieldId, value) =>
                  onFieldChange?.(node.actionId, 'title', value)
                }
              />
            </div>
          </div>
        );
      },
    });

    // Status column
    cols.push({
      id: 'status',
      header: 'Status',
      width: 110,
      minWidth: 90,
      align: 'center',
      sortKey: (row: TableRow) => {
        const node = row.data as WorkflowSurfaceNode;
        return node.payload.status || 'pending';
      },
      cell: (row: TableRow) => {
        const node = row.data as WorkflowSurfaceNode;
        const status = node.payload.status as DerivedStatus;

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <StatusFieldEditor
              value={status}
              statusConfig={statusConfig}
              onChange={(val) => onStatusChange?.(node.actionId, val as DerivedStatus)}
              compact
            />
          </div>
        );
      },
    });

    // Assignee column
    cols.push({
      id: 'assignee',
      header: 'Assignee',
      width: 130,
      minWidth: 100,
      align: 'center',
      sortKey: (row: TableRow) => {
        const node = row.data as WorkflowSurfaceNode;
        return node.payload.assignees?.[0]?.name || '';
      },
      cell: (row: TableRow) => {
        const node = row.data as WorkflowSurfaceNode;
        const assignee = node.payload.assignees?.[0];

        if (!assignee) {
          return (
            <span className="text-xs text-slate-400 italic">Unassigned</span>
          );
        }

        return (
          <span className="text-xs text-slate-700">{assignee.name}</span>
        );
      },
    });

    // Due date column
    cols.push({
      id: 'dueDate',
      header: 'Due Date',
      width: 110,
      minWidth: 90,
      align: 'center',
      sortKey: (row: TableRow) => {
        const node = row.data as WorkflowSurfaceNode;
        return node.payload.dueDate || '';
      },
      cell: (row: TableRow) => {
        const node = row.data as WorkflowSurfaceNode;
        const dueDate = node.payload.dueDate;

        if (!dueDate) {
          return <span className="text-xs text-slate-400">—</span>;
        }

        // Format date
        try {
          const date = new Date(dueDate);
          return (
            <span className="text-xs text-slate-700">
              {date.toLocaleDateString()}
            </span>
          );
        } catch {
          return <span className="text-xs text-slate-700">{dueDate}</span>;
        }
      },
    });

    return cols;
  }, [buildTitleViewModel, handleToggleExpanded, onFieldChange, onStatusChange, statusConfig]);

  // Row className for selection
  const getRowClassName = useCallback(
    (row: TableRow) => {
      const node = row.data as WorkflowSurfaceNode;
      const depth = (row.meta?.depth as number) || 0;
      const isSelected = node.actionId === selectedActionId;
      const cycleDetected = (row.meta?.cycleDetected as boolean) || false;

      if (cycleDetected) return 'bg-amber-50';
      if (isSelected) return 'bg-blue-50';
      if (depth > 0) return 'bg-slate-50/50';
      return '';
    },
    [selectedActionId]
  );

  // Row click handler
  const handleRowClick = useCallback(
    (rowId: string) => {
      onRowSelect?.(rowId);
    },
    [onRowSelect]
  );

  return (
    <div
      className={clsx(
        'flex flex-col border border-slate-200 rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Core table */}
      <UniversalTableCore
        rowModel={rowModel}
        columns={columns}
        onRowClick={handleRowClick}
        getRowClassName={getRowClassName}
        stickyHeader
        emptyState={<span className="text-sm">{emptyMessage}</span>}
      />

      {/* Add button */}
      {onAddAction && (
        <div className="border-t border-slate-200">
          <button
            onClick={onAddAction}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <Plus size={14} />
            Add Action
          </button>
        </div>
      )}
    </div>
  );
}
