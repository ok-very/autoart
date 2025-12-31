import { useState } from 'react';
import { Modal } from './Modal';
import { useCreateNode } from '../../api/hooks';
import type { NodeType } from '../../types';

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string;
  nodeType: Exclude<NodeType, 'project' | 'process'>;
}

export function CreateNodeModal({
  isOpen,
  onClose,
  parentId,
  nodeType,
}: CreateNodeModalProps) {
  const [title, setTitle] = useState('');
  const createNode = useCreateNode();

  const nodeLabel = {
    stage: 'Stage',
    subprocess: 'Subprocess',
    task: 'Task',
  }[nodeType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createNode.mutateAsync({
        parentId,
        type: nodeType,
        title: title.trim(),
        description: null,
        metadata: {},
      });
      setTitle('');
      onClose();
    } catch (err) {
      console.error('Failed to create node:', err);
    }
  };

  const handleClose = () => {
    setTitle('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Create ${nodeLabel}`}>
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

        <div className="flex justify-end gap-3 pt-2">
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
    </Modal>
  );
}
