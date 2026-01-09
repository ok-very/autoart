/**
 * CreateProjectView
 *
 * Drawer view for creating new projects. Uses Mantine form components.
 */

import { useState } from 'react';
import { TextInput, Button, Group, Stack, Text, Alert } from '@mantine/core';
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
      <Text size="sm" c="dimmed" mb="md">
        Create a new project to organize your work. Projects contain processes, stages, subprocesses, and tasks.
      </Text>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Project Name"
            placeholder="Enter project name..."
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            autoFocus
          />

          <TextInput
            label="Default Process Name"
            placeholder="Main Process"
            value={processName}
            onChange={(e) => setProcessName(e.currentTarget.value)}
            description="Every project needs at least one process. This will be created automatically."
          />

          <Group justify="flex-end" gap="sm" pt="md">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              loading={createNode.isPending}
            >
              Create Project
            </Button>
          </Group>

          {createNode.isError && (
            <Alert color="red" variant="light">
              Failed to create project. Please try again.
            </Alert>
          )}
        </Stack>
      </form>
    </div>
  );
}
