import { Plus } from 'lucide-react';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import { useUpdateNode } from '../../api/hooks';
import { Badge } from '../common/Badge';
import { RichTextEditor } from '../editor/RichTextEditor';

export function Workspace() {
  const { selectedNodeId, getNode, getChildren } = useHierarchyStore();
  const { inspectNode, openDrawer } = useUIStore();

  const selectedNode = selectedNodeId ? getNode(selectedNodeId) : null;
  const tasks = selectedNode?.type === 'subprocess' ? getChildren(selectedNode.id) : [];

  if (!selectedNode || selectedNode.type !== 'subprocess') {
    return (
      <main className="flex-1 bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <p className="text-lg font-medium">Select a subprocess to view tasks</p>
          <p className="text-sm mt-1">Choose from the hierarchy on the left</p>
        </div>
      </main>
    );
  }

  const metadata = (typeof selectedNode.metadata === 'string'
    ? JSON.parse(selectedNode.metadata)
    : selectedNode.metadata) as Record<string, unknown> || {};

  const renderMetadataValue = (value: unknown): string => {
    if (typeof value === 'object' && value !== null) {
      // Check if it's a TipTap doc
      if ('type' in value && (value as { type: string }).type === 'doc') {
        // Simple extraction of text from first paragraph
        const doc = value as { content?: Array<{ content?: Array<{ text?: string }> }> };
        const text = doc.content?.[0]?.content?.[0]?.text;
        return typeof text === 'string' ? text : '';
      }
      return JSON.stringify(value); // Fallback
    }
    return String(value);
  };

  return (
    <main className="flex-1 bg-white flex flex-col min-w-[400px] border-r border-slate-200 relative">
      {/* Subprocess Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="subprocess">Subprocess Record</Badge>
            <span className="text-xs text-slate-400 mono">ID: {selectedNode.id.slice(0, 8)}</span>
          </div>
          <button
            onClick={() => inspectNode(selectedNode.id)}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit Fields
          </button>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">{selectedNode.title}</h1>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          {'lead' in metadata && metadata.lead != null && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Lead:</span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium">
                @{renderMetadataValue(metadata.lead)}
              </span>
            </div>
          )}
          {'dueDate' in metadata && metadata.dueDate != null && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Due:</span>
              <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-medium">
                {renderMetadataValue(metadata.dueDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-3 custom-scroll">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}

        {/* Add Task Button */}
        <button
          onClick={() => openDrawer('create-node', { parentId: selectedNode.id, nodeType: 'task' })}
          className="w-full py-2 border border-dashed border-slate-300 rounded text-sm text-slate-400 hover:bg-white hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center gap-1"
        >
          <Plus size={16} />
          Add Task
        </button>
      </div>
    </main>
  );
}

interface TaskCardProps {
  task: ReturnType<typeof useHierarchyStore.getState>['nodes'][string];
}

function TaskCard({ task }: TaskCardProps) {
  const updateNode = useUpdateNode();
  const { inspectNode } = useUIStore();

  const description = task.description as { content?: Array<{ content?: Array<{ type: string; text?: string }> }> } | null;
  
  // Ensure metadata is an object
  const metadata = (typeof task.metadata === 'string' 
    ? JSON.parse(task.metadata) 
    : task.metadata) as Record<string, unknown> || {};

  const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
  const isCompleted = Boolean(metadata.completed);

  const handleToggleComplete = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    try {
      await updateNode.mutateAsync({
        id: task.id,
        metadata: {
          ...metadata,
          completed: e.target.checked,
        },
      });
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  return (
    <div
      onClick={() => inspectNode(task.id)}
      className={`bg-white border rounded-lg p-4 shadow-sm hover:border-blue-300 transition-all cursor-pointer group ${
        isCompleted ? 'border-green-200 bg-green-50/50' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={handleToggleComplete}
          onClick={(e) => e.stopPropagation()}
          disabled={updateNode.isPending}
          className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer disabled:opacity-50"
        />
        <div className="flex-1">
          <h3 className={`text-sm font-semibold ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
            {task.title}
          </h3>
          {description && (
            <div className={`text-sm mt-1 leading-relaxed ${isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>
              <RichTextEditor
                content={task.description}
                taskId={task.id}
                editable={false}
              />
            </div>
          )}
          {tags.length > 0 && (
            <div className="mt-2 flex gap-2">
              {tags.map((tag) => {
                const tagLabel = typeof tag === 'object' ? JSON.stringify(tag) : String(tag);
                return (
                  <span
                    key={tagLabel}
                    className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                  >
                    {tagLabel}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
