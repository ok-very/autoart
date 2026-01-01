import { ChevronDown, ChevronRight, Folder, FolderOpen, Trash2, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { clsx } from 'clsx';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import { useDeleteNode, useMoveNode, useCloneNode } from '../../api/hooks';
import type { HierarchyNode } from '../../types';

interface TreeNodeProps {
  node: HierarchyNode;
  level: number;
}

export function TreeNode({ node, level }: TreeNodeProps) {
  const { getChildren, expandedIds, toggleExpand } = useHierarchyStore();
  const { selection, setSelection, openDrawer } = useUIStore();
  const deleteNode = useDeleteNode();
  const moveNode = useMoveNode();
  const cloneNode = useCloneNode();

  const children = getChildren(node.id);
  // Only get siblings if parent_id exists (not root nodes like projects)
  const siblings = node.parent_id ? getChildren(node.parent_id) : [];

  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  
  const isSelected = selection?.type === 'node' && selection.id === node.id;

  const isFolder = node.type === 'stage';
  const isSubprocess = node.type === 'subprocess';

  // Determine index for move operations - validate index is valid
  const index = siblings.findIndex(n => n.id === node.id);
  const validIndex = index >= 0; // Ensure node was found in siblings
  const canMoveUp = validIndex && index > 0;
  const canMoveDown = validIndex && index < siblings.length - 1;

  const handleClick = () => {
    setSelection({ type: 'node', id: node.id });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpand(node.id);
  };

  // Get status indicator color from metadata
  const metadata = (typeof node.metadata === 'string' ? JSON.parse(node.metadata) : node.metadata) as Record<string, string> || {};
  const status = metadata.status;
  const statusColor = status === 'active' ? 'bg-orange-500' : 'bg-slate-300';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDrawer('confirm-delete', {
      title: `Delete ${node.type}`,
      message: `Are you sure you want to delete this ${node.type}? ${hasChildren ? 'This will also delete all child items.' : ''}`,
      itemName: node.title,
      onConfirm: async () => {
        await deleteNode.mutateAsync(node.id);
        // Clear selection if this node was selected
        if (isSelected) {
          setSelection(null);
        }
      },
    });
  };

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canMoveUp || !node.parent_id) return;
    moveNode.mutate(
      { id: node.id, newParentId: node.parent_id, position: index - 1 },
      {
        onError: (err) => {
          console.error('Failed to move node up:', err);
        },
      }
    );
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canMoveDown || !node.parent_id) return;
    moveNode.mutate(
      { id: node.id, newParentId: node.parent_id, position: index + 1 },
      {
        onError: (err) => {
          console.error('Failed to move node down:', err);
        },
      }
    );
  };

  const handleClone = (e: React.MouseEvent) => {
    e.stopPropagation();
    cloneNode.mutate(
      {
        sourceNodeId: node.id,
        targetParentId: node.parent_id,
        overrides: { title: `${node.title} (Copy)` },
      },
      {
        onError: (err) => {
          console.error('Failed to clone node:', err);
        },
      }
    );
  };

  // Determine if this node can be deleted/moved/cloned (not projects or processes at root)
  const canModify = node.type !== 'project' && node.type !== 'process';

  return (
    <div className="mb-1">
      <button
        onClick={handleClick}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded text-left transition-all group',
          {
            'hover:bg-slate-100 text-slate-700': !isSelected && !isSubprocess,
            'bg-white border border-blue-200 shadow-sm text-slate-800': isSelected && isSubprocess,
            'hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200': !isSelected && isSubprocess,
          }
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {/* Expand/Collapse Toggle */}
        {hasChildren && (
          <span
            onClick={handleToggle}
            className="text-slate-400 text-[10px] hover:text-slate-600 cursor-pointer"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        {!hasChildren && <span className="w-3" />}

        {/* Icon */}
        {isFolder && (
          <span className="text-yellow-500">
            {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
          </span>
        )}

        {/* Status Indicator for Subprocesses */}
        {isSubprocess && (
          <span className={clsx('w-1.5 h-1.5 rounded-full', statusColor)} />
        )}

        {/* Title */}
        <span className={clsx('flex-1 truncate', { 'text-slate-800': isFolder })}>
          {node.title}
        </span>

        {/* Subprocess badge */}
        {isSubprocess && (
          <span className="text-[10px] bg-slate-100 text-slate-400 px-1 rounded opacity-0 group-hover:opacity-100">
            SUB
          </span>
        )}

        {/* Actions Group */}
        {canModify && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
            <span
              onClick={handleClone}
              className="text-slate-300 hover:text-blue-500 p-0.5 rounded hover:bg-blue-50"
              title="Duplicate"
            >
              <Copy size={12} />
            </span>
            <span
              onClick={handleMoveUp}
              className={clsx(
                "p-0.5 rounded transition-colors",
                canMoveUp ? "text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer" : "text-slate-200 cursor-default"
              )}
              title="Move Up"
            >
              <ArrowUp size={12} />
            </span>
            <span
              onClick={handleMoveDown}
              className={clsx(
                "p-0.5 rounded transition-colors",
                canMoveDown ? "text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer" : "text-slate-200 cursor-default"
              )}
              title="Move Down"
            >
              <ArrowDown size={12} />
            </span>
            <span
              onClick={handleDelete}
              className="text-slate-300 hover:text-red-500 p-0.5 rounded hover:bg-red-50"
              title="Delete"
            >
              <Trash2 size={12} />
            </span>
          </div>
        )}
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="relative ml-2 pl-3 mt-1 space-y-1">
          <div className="tree-line" />
          {children.map((child) => (
            <div key={child.id} className="relative z-10">
              <TreeNode node={child} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
