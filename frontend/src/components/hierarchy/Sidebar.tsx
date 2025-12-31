import { useEffect } from 'react';
import { Settings, Plus } from 'lucide-react';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import { useProjectTree, useRecordDefinitions } from '../../api/hooks';
import { TreeNode } from './TreeNode';
import type { NodeType } from '../../types';

export function Sidebar() {
  const { selectedProjectId, selectedNodeId, setNodes, getChildren, getNode } = useHierarchyStore();
  const { inspectNode, sidebarWidth, openDrawer } = useUIStore();
  const { data: nodes } = useProjectTree(selectedProjectId);
  const { data: definitions } = useRecordDefinitions();

  // Update store when nodes load
  useEffect(() => {
    if (nodes) {
      setNodes(nodes);
    }
  }, [nodes, setNodes]);

  const project = selectedProjectId ? getNode(selectedProjectId) : null;
  const processes = project ? getChildren(project.id) : [];
  const selectedProcess = processes[0]; // Default to first process
  const stages = selectedProcess ? getChildren(selectedProcess.id) : [];

  // Determine what type of node to create based on current selection
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
      {selectedProcess && (
        <div className="p-3 border-b border-slate-200 bg-white">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
            Current Process
          </label>
          <button
            onClick={() => inspectNode(selectedProcess.id)}
            className="w-full flex items-center justify-between bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-900 px-3 py-2 rounded-lg transition-colors text-left group"
          >
            <div className="flex items-center gap-2">
              <Settings size={16} />
              <span className="text-sm font-semibold">{selectedProcess.title}</span>
            </div>
            <span className="text-purple-400 text-xs group-hover:text-purple-600">Edit</span>
          </button>
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

      {/* Quick Create Records - Only shows pinned definitions */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Quick Create</div>
        <div className="flex flex-wrap gap-2">
          {definitions && definitions.length > 0 ? (
            (() => {
              // Filter to only pinned definitions (exclude hierarchy types)
              const pinnedDefs = definitions.filter(
                (def) =>
                  def.pinned &&
                  !['project', 'process', 'stage', 'subprocess', 'task'].includes(def.name.toLowerCase())
              );

              if (pinnedDefs.length === 0) {
                return (
                  <span className="text-xs text-slate-400 italic">
                    No pinned record types. Pin types in the Schema tab.
                  </span>
                );
              }

              return pinnedDefs.slice(0, 8).map((def) => {
                const icon = def.styling?.icon;
                const color = def.styling?.color || 'slate';
                return (
                  <button
                    key={def.id}
                    onClick={() =>
                      openDrawer('create-record', {
                        definitionId: def.id,
                        classificationNodeId: selectedNodeId || undefined,
                      })
                    }
                    className={`w-8 h-8 rounded bg-${color}-50 border border-${color}-200 flex items-center justify-center shadow-sm cursor-pointer hover:border-${color}-400 hover:bg-${color}-100 transition-colors text-sm`}
                    title={`Create ${def.name}`}
                  >
                    {icon || def.name.charAt(0).toUpperCase()}
                  </button>
                );
              });
            })()
          ) : (
            <span className="text-xs text-slate-400 italic">No record types defined</span>
          )}
        </div>
      </div>
    </aside>
  );
}
