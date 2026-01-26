/**
 * CreateNodeView
 *
 * Overlay view for creating hierarchy nodes.
 *
 * @deprecated Legacy props are deprecated. Use OverlayProps<CreateNodeContext> instead.
 */

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { useCreateNode } from '@/api/hooks';
import { useUIStore } from '@/stores';
import type { NodeType } from '@/types';

import type { OverlayProps, CreateNodeContext } from '../../../overlay/types';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { TextInput } from '@autoart/ui';

/**
 * @deprecated Use OverlayProps<CreateNodeContext> instead.
 */
interface LegacyCreateNodeViewProps {
  parentId: string;
  nodeType: Exclude<NodeType, 'project' | 'process'>;
}

// New contract props
type CreateNodeViewProps = OverlayProps<CreateNodeContext, { nodeId: string }>;

// Type guard to detect legacy vs new props
function isOverlayProps(props: unknown): props is CreateNodeViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props;
}

export function CreateNodeView(props: CreateNodeViewProps | LegacyCreateNodeViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isOverlayProps(props);
  const parentId = isNewContract ? props.context.parentId : props.parentId;
  const nodeType = isNewContract ? props.context.nodeType : props.nodeType;
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const [title, setTitle] = useState('');
  const { closeOverlay } = useUIStore();
  const createNode = useCreateNode();

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeOverlay();
    }
  };

  const nodeLabel = {
    stage: 'Stage',
    subprocess: 'Subprocess',
    task: 'Task',
    subtask: 'Subtask',
    process: 'Process',
    template: 'Template',
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
        closeOverlay();
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
      <Text size="sm" color="dimmed" className="mb-4">
        Add a new {nodeLabel.toLowerCase()} to the hierarchy.
      </Text>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder={`Enter ${nodeLabel.toLowerCase()} title...`}
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            autoFocus
          />

          <Inline justify="end" gap="sm" className="pt-4">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createNode.isPending}
              leftSection={<Plus size={16} />}
            >
              {createNode.isPending ? 'Creating...' : `Create ${nodeLabel}`}
            </Button>
          </Inline>

          {createNode.isError && (
            <Text size="sm" color="error">
              Failed to create {nodeLabel.toLowerCase()}. Please try again.
            </Text>
          )}
        </Stack>
      </form>
    </div>
  );
}
