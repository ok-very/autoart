import { Plus, ChevronRight } from 'lucide-react';

import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import type { NodeType, HierarchyNode } from '../../types';

interface MillerColumnProps {
  type: NodeType;
  parentId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  hasChildren?: (id: string) => boolean;
}

const COLUMN_CONFIG: Record<NodeType, { label: string; badge: string; bgColor: string; textColor: string }> = {
  project: { label: 'Projects', badge: 'P', bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
  process: { label: 'Process', badge: 'M', bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
  stage: { label: 'Stages', badge: 'F', bgColor: 'bg-yellow-100', textColor: 'text-yellow-600' },
  subprocess: { label: 'Subprocesses', badge: 'S', bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
  template: { label: 'Templates', badge: 'TP', bgColor: 'bg-pink-100', textColor: 'text-pink-600' },
};

export function MillerColumn({
  type,
  parentId,
  selectedId,
  onSelect,
  hasChildren,
}: MillerColumnProps) {
  const { getChildren } = useHierarchyStore();
  const { openOverlay } = useUIStore();

  const items = getChildren(parentId);
  const config = COLUMN_CONFIG[type];

  const handleAdd = () => {
    if (parentId) {
      openOverlay('create-node', { parentId, nodeType: type });
    } else if (type === 'project') {
      openOverlay('create-project', {});
    }
  };

  return (
    <div className="flex-shrink-0 w-80 border-r border-slate-200 bg-white flex flex-col">
      {/* Column Header */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded ${config.bgColor} ${config.textColor} flex items-center justify-center text-xs font-bold`}>
            {config.badge}
          </span>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            {config.label}
          </span>
        </div>
        <button
          onClick={handleAdd}
          className="text-slate-400 hover:text-blue-600 transition-colors"
          title={`Add ${type}`}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        {items.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-400">
            No {config.label.toLowerCase()} yet
          </div>
        ) : (
          items.map((item) => (
            <MillerColumnItem
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              onClick={() => onSelect(item.id)}
              showArrow={hasChildren ? hasChildren(item.id) : true}
            />
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
        {items.length} {items.length === 1 ? type : config.label.toLowerCase()}
      </div>
    </div>
  );
}

interface MillerColumnItemProps {
  item: HierarchyNode;
  isSelected: boolean;
  onClick: () => void;
  showArrow?: boolean;
}

function MillerColumnItem({ item, isSelected, onClick, showArrow = true }: MillerColumnItemProps) {
  const metadata = (typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata) as Record<string, unknown> || {};
  const isCompleted = Boolean(metadata.completed);

  return (
    <div
      onClick={onClick}
      className={`
        px-4 py-3 border-b border-slate-100 cursor-pointer
        flex justify-between items-center gap-2
        transition-colors
        ${isSelected
          ? 'bg-blue-50 border-l-[3px] border-l-blue-500'
          : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
        }
      `}
    >
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold truncate ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
          {item.title}
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          ID: {item.id.slice(0, 8)}
        </div>
        {item.type === 'subprocess' && (
          <div className="flex gap-1 mt-1">
            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1 rounded border border-emerald-100">
              Active
            </span>
          </div>
        )}
      </div>
      {showArrow && (
        <ChevronRight
          size={18}
          className={`flex-shrink-0 transition-opacity ${isSelected ? 'opacity-100 text-blue-500' : 'opacity-30'}`}
        />
      )}
    </div>
  );
}
