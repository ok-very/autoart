/**
 * CreateNodeView
 *
 * Drawer view for creating hierarchy nodes using Mantine.
 *
 * @deprecated Legacy props are deprecated. Use DrawerProps<CreateNodeContext> instead.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TextInput, Button, Stack, Group, Text, Box } from '@mantine/core';
import { useUIStore } from '../../../stores/uiStore';
import { useCreateNode } from '../../../api/hooks';
import type { NodeType } from '../../../types';
import type { DrawerProps, CreateNodeContext } from '../../../drawer/types';

/**
 * @deprecated Use DrawerProps<CreateNodeContext> instead.
 */
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
    <Box maw={480} mx="auto">
      <Text size="sm" c="dimmed" mb="md">
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

          <Group justify="flex-end" gap="sm" pt="md">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              loading={createNode.isPending}
              leftSection={<Plus size={16} />}
            >
              Create {nodeLabel}
            </Button>
          </Group>

          {createNode.isError && (
            <Text size="sm" c="red">
              Failed to create {nodeLabel.toLowerCase()}. Please try again.
            </Text>
          )}
        </Stack>
      </form>
    </Box>
  );
}
