/**
 * CreateProjectView
 *
 * Overlay view for creating new projects.
 */

import { useState } from 'react';

import { useCreateNode } from '@/api/hooks';
import { useUIStore, useHierarchyStore } from '@/stores';

import type { OverlayProps, CreateProjectContext } from '../../../overlay/types';
import { Alert } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { TextInput } from '@autoart/ui';

// Legacy props interface (deprecated - use OverlayProps)
interface LegacyCreateProjectViewProps {
  templateId?: string;
}

// New contract props
type CreateProjectViewProps = OverlayProps<CreateProjectContext, { projectId: string }>;

// Type guard to detect legacy vs new props
function isOverlayProps(props: unknown): props is CreateProjectViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props;
}

export function CreateProjectView(props: CreateProjectViewProps | LegacyCreateProjectViewProps | Record<string, never> = {}) {
  // Handle both legacy and new contract
  const isNewContract = isOverlayProps(props);
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const [title, setTitle] = useState('');
  const [processName, setProcessName] = useState('Main Process');
  const { closeOverlay } = useUIStore();
  const { selectProject } = useHierarchyStore();
  const createNode = useCreateNode();

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeOverlay();
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
            sideEffects: [{ type: 'create', entityKind: 'project' }],
          });
        } else {
          // Legacy: auto-select and close
          selectProject(projectResult.node.id);
          setTitle('');
          setProcessName('Main Process');
          closeOverlay();
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
      <Text size="sm" color="muted" className="mb-4">
        Create a new project to organize your work. Projects contain processes, stages, subprocesses, and tasks.
      </Text>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Project Name"
            placeholder="Enter project name..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          <TextInput
            label="Default Process Name"
            placeholder="Main Process"
            value={processName}
            onChange={(e) => setProcessName(e.target.value)}
            description="Every project needs at least one process. This will be created automatically."
          />

          <Inline justify="end" gap="sm" className="pt-4">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createNode.isPending}
            >
              {createNode.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </Inline>

          {createNode.isError && (
            <Alert variant="error">
              Failed to create project. Please try again.
            </Alert>
          )}
        </Stack>
      </form>
    </div>
  );
}
