import { useEffect, useState } from 'react';
import { Settings, Plus, ChevronDown } from 'lucide-react';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import { useProjectTree } from '../../api/hooks';
import { TreeNode } from './TreeNode';
import type { NodeType } from '../../types';

export function Sidebar() {
  const { setNodes, getChildren, getNode } = useHierarchyStore();
  const { activeProjectId, selection, setSelection, sidebarWidth, openDrawer } = useUIStore();
  const { data: nodes } = useProjectTree(activeProjectId);

  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [isProcessDropdownOpen, setIsProcessDropdownOpen] = useState(false);

  // Update store when nodes load
  useEffect(() => {
    if (nodes) {
      setNodes(nodes);
    }
  }, [nodes, setNodes]);

  const project = activeProjectId ? getNode(activeProjectId) : null;
  const processes = project ? getChildren(project.id) : [];

  // Auto-select first process when processes change or none selected
  useEffect(() => {
    if (processes.length > 0 && (!selectedProcessId || !processes.find(p => p.id === selectedProcessId))) {
      setSelectedProcessId(processes[0].id);
    }
  }, [processes, selectedProcessId]);

  const selectedProcess = selectedProcessId ? getNode(selectedProcessId) : null;
  const stages = selectedProcess ? getChildren(selectedProcess.id) : [];

  // Determine what type of node to create based on current selection
  const selectedNodeId = selection?.type === 'node' ? selection.id : null;
  const selectedNode = selectedNodeId ? getNode(selectedNodeId) : null;

  const getCreateNodeConfig = (): { parentId: string; nodeType: Exclude<NodeType, 'project' | 'process'> } | null => {
    if (!selectedProcess) return null;

    if (!selectedNode || selectedNode.type === 'process') {
      // No selection or process selected → create stage under process
      return { parentId: selectedProcess.id, nodeType: 'stage' };
    }
    if (selectedNode.type === 'stage') {
      // Stage selected → create subprocess under stage
      return { parentId: selectedNode.id, nodeType: 'subprocess' };
    }
    if (selectedNode.type === 'subprocess') {
      // Subprocess selected → create stage under process (sibling to parent's parent)
      return { parentId: selectedProcess.id, nodeType: 'stage' };
    }
    // Default: create stage
    return { parentId: selectedProcess.id, nodeType: 'stage' };
  };

  const createConfig = getCreateNodeConfig();

  return (
    <aside
      className="bg-slate-50 border-r border-slate-200 flex flex-col shrink-0"
      style={{ width: sidebarWidth }}
    >
      {/* Process Selector */}
      {processes.length > 0 && (
        <div className="p-3 border-b border-slate-200 bg-white">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
            Process {processes.length > 1 && `(${processes.length})`}
          </label>
          <div className="relative">
            <button
              onClick={() => processes.length > 1 ? setIsProcessDropdownOpen(!isProcessDropdownOpen) : setSelection({ type: 'node', id: selectedProcess!.id })}
              className="w-full flex items-center justify-between bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-900 px-3 py-2 rounded-lg transition-colors text-left group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Settings size={16} className="shrink-0" />
                <span className="text-sm font-semibold truncate">{selectedProcess?.title || 'Select process'}</span>
              </div>
              {processes.length > 1 ? (
                <ChevronDown size={16} className={`text-purple-400 transition-transform ${isProcessDropdownOpen ? 'rotate-180' : ''}`} />
              ) : (
                <span className="text-purple-400 text-xs group-hover:text-purple-600">Edit</span>
              )}
            </button>

            {/* Process Dropdown */}
            {isProcessDropdownOpen && processes.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                {processes.map((process) => (
                  <button
                    key={process.id}
                    onClick={() => {
                      setSelectedProcessId(process.id);
                      setIsProcessDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${process.id === selectedProcessId ? 'bg-purple-50 text-purple-700' : 'text-slate-700'
                      }`}
                  >
                    <Settings size={14} className="shrink-0" />
                    <span className="truncate">{process.title}</span>
                  </button>
                ))}
                <div className="border-t border-slate-100">
                  <button
                    onClick={() => {
                      setIsProcessDropdownOpen(false);
                      if (selectedProcess) setSelection({ type: 'node', id: selectedProcess.id });
                    }}
                    className="w-full px-3 py-2 text-xs text-purple-600 hover:bg-purple-50 text-left"
                  >
                    Edit current process
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2 custom-scroll">
        {stages.map((stage) => (
          <TreeNode key={stage.id} node={stage} level={0} />
        ))}

        {/* Create New Button */}
        <div className="pt-4 px-2">
          <button
            onClick={() => createConfig && openDrawer('create-node', createConfig)}
            disabled={!createConfig}
            className="w-full py-2 border border-dashed border-slate-300 rounded text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={14} />
            New {createConfig?.nodeType === 'subprocess' ? 'Subprocess' : 'Stage'}
          </button>
        </div>
      </div>
    </aside>
  );
}
