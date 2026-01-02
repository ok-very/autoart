import { useState } from 'react';
import { useUIStore } from '../../../stores/uiStore';
import { useCreateNode } from '../../../api/hooks';
import type { NodeType } from '../../../types';
import type { DrawerProps, CreateNodeContext } from '../../../drawer/types';

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyCreateNodeViewProps {
  parentId: string;
  nodeType: Exclude<NodeType, 'project' | 'process'>;
}

// New contract props
type CreateNodeViewProps = DrawerProps<CreateNodeContext, { nodeId: string }>;

// Type guard to detect legacy vs new props
function isDrawerProps(props: unknown): props is CreateNodeViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props;
}

export function CreateNodeView(props: CreateNodeViewProps | LegacyCreateNodeViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isDrawerProps(props);
  const parentId = isNewContract ? props.context.parentId : props.parentId;
  const nodeType = isNewContract ? props.context.nodeType : props.nodeType;
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const [title, setTitle] = useState('');
  const { closeDrawer } = useUIStore();
  const createNode = useCreateNode();

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeDrawer();
    }
  };

  const nodeLabel = {
    stage: 'Stage',
    subprocess: 'Subprocess',
    task: 'Task',
    subtask: 'Subtask',
    process: 'Process',
  }[nodeType] || nodeType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const result = await createNode.mutateAsync({
        parentId,
        type: nodeType as Exclude<NodeType, 'project' | 'process'>,
        title: title.trim(),
        description: null,
        metadata: {},
      });

      if (onSubmit) {
        // New contract: emit typed result
        onSubmit({
          success: true,
          data: { nodeId: result.node?.id || '' },
          sideEffects: [{ type: 'create', entityType: 'node' }],
        });
      } else {
        // Legacy: close
        setTitle('');
        closeDrawer();
      }
    } catch (err) {
      console.error('Failed to create node:', err);
      if (onSubmit) {
        onSubmit({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to create node',
        });
      }
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <p className="text-sm text-slate-600">
          Add a new {nodeLabel.toLowerCase()} to the hierarchy.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Enter ${nodeLabel.toLowerCase()} title...`}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || createNode.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createNode.isPending ? 'Creating...' : `Create ${nodeLabel}`}
          </button>
        </div>

        {createNode.isError && (
          <p className="text-sm text-red-600">
            Failed to create {nodeLabel.toLowerCase()}. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
