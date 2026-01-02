import { useState } from 'react';
import { useUIStore } from '../../../stores/uiStore';
import { useHierarchyStore } from '../../../stores/hierarchyStore';
import { useCreateNode } from '../../../api/hooks';
import type { DrawerProps, CreateProjectContext } from '../../../drawer/types';

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyCreateProjectViewProps {
  templateId?: string;
}

// New contract props
type CreateProjectViewProps = DrawerProps<CreateProjectContext, { projectId: string }>;

// Type guard to detect legacy vs new props
function isDrawerProps(props: unknown): props is CreateProjectViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props;
}

export function CreateProjectView(props: CreateProjectViewProps | LegacyCreateProjectViewProps | Record<string, never> = {}) {
  // Handle both legacy and new contract
  const isNewContract = isDrawerProps(props);
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const [title, setTitle] = useState('');
  const [processName, setProcessName] = useState('Main Process');
  const { closeDrawer } = useUIStore();
  const { selectProject } = useHierarchyStore();
  const createNode = useCreateNode();

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeDrawer();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      // Create the project
      const projectResult = await createNode.mutateAsync({
        parentId: null,
        type: 'project',
        title: title.trim(),
        description: null,
        metadata: {},
      });

      // Create a default process under the project
      if (projectResult.node) {
        await createNode.mutateAsync({
          parentId: projectResult.node.id,
          type: 'process',
          title: processName.trim() || 'Main Process',
          description: null,
          metadata: {},
        });

        if (onSubmit) {
          // New contract: emit typed result
          onSubmit({
            success: true,
            data: { projectId: projectResult.node.id },
            sideEffects: [{ type: 'create', entityType: 'project' }],
          });
        } else {
          // Legacy: auto-select and close
          selectProject(projectResult.node.id);
          setTitle('');
          setProcessName('Main Process');
          closeDrawer();
        }
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      if (onSubmit) {
        onSubmit({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to create project',
        });
      }
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <p className="text-sm text-slate-600">
          Create a new project to organize your work. Projects contain processes, stages, subprocesses, and tasks.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="project-title"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Project Name
          </label>
          <input
            id="project-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter project name..."
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="process-name"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Default Process Name
          </label>
          <input
            id="process-name"
            type="text"
            value={processName}
            onChange={(e) => setProcessName(e.target.value)}
            placeholder="Main Process"
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Every project needs at least one process. This will be created automatically.
          </p>
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
            {createNode.isPending ? 'Creating...' : 'Create Project'}
          </button>
        </div>

        {createNode.isError && (
          <p className="text-sm text-red-600">
            Failed to create project. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
