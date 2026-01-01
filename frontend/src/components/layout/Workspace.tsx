import { Plus } from 'lucide-react';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import { useUpdateNode } from '../../api/hooks';
import { Badge } from '../common/Badge';
import { RichTextEditor } from '../editor/RichTextEditor';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { ProgressBar } from '../common/ProgressBar';
import { calculateStatusDistribution, StatusKey, STATUS_COLORS, STATUS_LABELS } from '../../utils/statusUtils';
import type { HierarchyNode, NodeType } from '../../types'; // Import NodeType
import { parseTaskMetadata, deriveTaskStatus } from '../../utils/nodeMetadata';

// Helper to safely parse metadata
const parseMetadata = (metadata: HierarchyNode['metadata']): Record<string, unknown> => {
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch (e) {
      console.error("Error parsing metadata string:", e);
      return {};
    }
  }
  return metadata || {};
};

interface TaskCardProps {
  task: HierarchyNode;
}

function TaskCard({ task }: TaskCardProps) {
  const updateNode = useUpdateNode();
  const { setSelection } = useUIStore();

  const description = task.description as { content?: Array<{ content?: Array<{ type: string; text?: string }> }> } | null;

  const rawMetadata = parseMetadata(task.metadata);
  const taskMeta = parseTaskMetadata(rawMetadata);

  const tags = Array.isArray(taskMeta.tags) ? taskMeta.tags : [];
  const currentStatus: StatusKey = deriveTaskStatus(taskMeta);

  // Local states for editable fields
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(taskMeta.dueDate || '');
  const [status, setLocalStatus] = useState<StatusKey>(currentStatus);

  // Update local states if task prop changes
  useEffect(() => {
    setTitle(task.title);
    setDueDate(taskMeta.dueDate || '');
    setLocalStatus(currentStatus);
  }, [task, currentStatus, taskMeta.dueDate]);

  const handleUpdateMetadata = async (key: string, value: unknown) => {
    try {
      await updateNode.mutateAsync({
        id: task.id,
        metadata: {
          ...rawMetadata,
          [key]: value,
        },
      });
    } catch (err) {
      console.error(`Failed to update task ${key}:`, err);
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    setTitle(newTitle); // Optimistic update
    try {
      await updateNode.mutateAsync({
        id: task.id,
        title: newTitle,
      });
    } catch (err) {
      console.error('Failed to update task title:', err);
      setTitle(task.title); // Revert on error
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as StatusKey;
    setLocalStatus(newStatus); // Optimistic update
    handleUpdateMetadata('status', newStatus);
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDueDate = e.target.value;
    setDueDate(newDueDate); // Optimistic update
    handleUpdateMetadata('dueDate', newDueDate);
  };

  const isCompleted = status === 'done'; // Derive completion from status

  return (
    <div
      onClick={() => setSelection({ type: 'node', id: task.id })}
      className={`bg-white border rounded-lg p-4 shadow-sm hover:border-blue-300 transition-all cursor-pointer group ${isCompleted ? 'border-green-200 bg-green-50/50' : 'border-slate-200'
        }`}
    >
      <div className="flex items-start gap-3">
        {/* Status Selector */}
        <select
          value={status}
          onChange={handleStatusChange}
          onClick={(e) => e.stopPropagation()} // Prevent card click
          disabled={updateNode.isPending}
          className="mt-1 w-6 h-6 p-0 text-white rounded border-slate-300 cursor-pointer disabled:opacity-50 appearance-none text-center text-xs font-medium"
          style={{ backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.default }}
        >
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key} className="bg-white text-slate-800">
              {label || key}
            </option>
          ))}
        </select>

        <div className="flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={(e) => handleUpdateTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className={`w-full text-sm font-semibold border-none bg-transparent focus:outline-none focus:ring-0 ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'
              }`}
          />
          {description && (
            <div className={`text-sm mt-1 leading-relaxed ${isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>
              <RichTextEditor
                content={task.description}
                taskId={task.id}
                editable={false}
              />
            </div>
          )}
          {taskMeta.dueDate !== undefined && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Due Date:</span>
              <input
                type="date"
                value={dueDate}
                onChange={handleDueDateChange}
                onClick={(e) => e.stopPropagation()}
                className="text-xs border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

// Subcomponent to render subprocesses and their tasks
interface SubprocessSectionProps {
  subprocess: HierarchyNode;
}

function SubprocessSection({ subprocess }: SubprocessSectionProps) {
  const { getChildren } = useHierarchyStore();
  const { openDrawer } = useUIStore();
  const tasks = getChildren(subprocess.id).filter(node => node.type === 'task');

  return (
    <div className="pl-4 border-l border-slate-200 ml-2 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-bold text-slate-700">{subprocess.title}</h4>
        <button
          onClick={() => openDrawer('create-node', { parentId: subprocess.id, nodeType: 'task' })}
          className="text-xs text-blue-600 hover:underline"
        >
          <Plus size={12} className="inline-block mr-1" /> Add Task
        </button>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

// Subcomponent to render stages and their subprocesses
interface StageSectionProps {
  stage: HierarchyNode;
}

function StageSection({ stage }: StageSectionProps) {
  const { getChildren } = useHierarchyStore();
  const { openDrawer } = useUIStore();
  const subprocesses = getChildren(stage.id).filter(node => node.type === 'subprocess');
  const [isExpanded, setIsExpanded] = useState(true); // State to manage stage expansion

  const metadata = parseMetadata(stage.metadata);
  const isCompleted = metadata.status === 'done'; // Assuming stages can also have a status

  return (
    <div className={`mb-8 p-4 rounded-lg border ${isCompleted ? 'border-green-200 bg-green-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-800 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          {stage.title}
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="stage">{stage.type}</Badge>
          <button
            onClick={() => openDrawer('create-node', { parentId: stage.id, nodeType: 'subprocess' })}
            className="text-xs text-blue-600 hover:underline"
          >
            <Plus size={12} className="inline-block mr-1" /> Add Subprocess
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-400 hover:text-slate-600">
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      {stage.description && <p className="text-sm text-slate-600 mt-2">{stage.description}</p>}

      {isExpanded && (
        <div className="mt-6 space-y-6">
          {subprocesses.map((subprocess) => (
            <SubprocessSection key={subprocess.id} subprocess={subprocess} />
          ))}
        </div>
      )}
    </div>
  );
}


export function Workspace() {
  const { getChildren } = useHierarchyStore();
  const { activeProjectId, selection } = useUIStore();

  const selectedNodeId = selection?.type === 'node' ? selection.id : null;
  const selectedNode = selectedNodeId ? getChildren(activeProjectId || null).find(node => node.id === selectedNodeId) : null;


  // Filter hierarchy to get stages for the active project
  const stages = useMemo(() => {
    if (!activeProjectId) return [];
    return getChildren(activeProjectId).filter(node => node.type === 'stage');
  }, [activeProjectId, getChildren]);

  // Aggregate all tasks from all subprocesses of all stages for status distribution
  const allTasks = useMemo(() => {
    if (!activeProjectId) return [];
    let tasks: HierarchyNode[] = [];
    stages.forEach(stage => {
      const subprocesses = getChildren(stage.id).filter(node => node.type === 'subprocess');
      subprocesses.forEach(subprocess => {
        tasks = tasks.concat(getChildren(subprocess.id).filter(node => node.type === 'task'));
      });
    });
    return tasks;
  }, [activeProjectId, stages, getChildren]);

  const statusDistribution = useMemo(() => {
    return calculateStatusDistribution(allTasks, (task) => {
      const meta = parseTaskMetadata(parseMetadata(task.metadata));
      return deriveTaskStatus(meta);
    });
  }, [allTasks]);


  // Placeholder for when no project is selected or stage is selected
  if (!activeProjectId) {
    return (
      <main className="flex-1 bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <p className="text-lg font-medium">Select a project to view its workflow</p>
          <p className="text-sm mt-1">Choose from the top menu</p>
        </div>
      </main>
    );
  }

  // Display project-level header (simplified for now)
  const project = getChildren(null).find(node => node.id === activeProjectId);

  return (
    <main className="flex-1 bg-white flex flex-col min-w-[400px] border-r border-slate-200 relative">
      {/* Project Header - could be more elaborate */}
      {project && (
        <div className="px-6 py-4 border-b border-slate-100 bg-white flex-shrink-0">
          <h1 className="text-2xl font-bold text-slate-800">{project.title} Workflow</h1>
          {project.description && <p className="text-sm text-slate-600">{project.description}</p>}
        </div>
      )}

      {/* Workflow Content: Stages and Subprocesses */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 custom-scroll">
        {stages.length === 0 ? (
          <div className="text-center text-slate-400">
            <p className="text-lg font-medium">No stages defined for this project</p>
            {/* Add button to create first stage? */}
          </div>
        ) : (
          <div className="space-y-8">
            {stages.map((stage) => (
              <StageSection key={stage.id} stage={stage} />
            ))}
          </div>
        )}
      </div>

      {/* FOOTER SUMMARY (Progress Widget) */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between sticky bottom-0 z-10">
        <span className="text-sm font-semibold text-slate-700">Total Task Progress ({allTasks.length} tasks)</span>
        <div className="w-48">
          <ProgressBar distribution={statusDistribution} />
        </div>
      </div>
    </main>
  );
}
