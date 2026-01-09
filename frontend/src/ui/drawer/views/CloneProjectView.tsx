/**
 * CloneProjectView
 *
 * Drawer view for cloning a project with configurable depth using Mantine.
 */

import { useState } from 'react';
import { Copy, FileText, Database, Layers } from 'lucide-react';
import {
  TextInput, Button, Stack, Group, Text, Paper, Radio, Checkbox,
  Box, Alert, ThemeIcon, Badge
} from '@mantine/core';
import { useUIStore } from '../../../stores/uiStore';
import { useHierarchyStore } from '../../../stores/hierarchyStore';
import { useCloneNode, useCloneStats } from '../../../api/hooks';
import type { DrawerProps, CloneProjectContext } from '../../../drawer/types';

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyCloneProjectViewProps {
  sourceProjectId: string;
  sourceProjectTitle: string;
}

// New contract props
type CloneProjectViewProps = DrawerProps<CloneProjectContext & { sourceProjectId?: string; sourceProjectTitle?: string }, { projectId: string }>;

// Type guard to detect legacy vs new props
function isDrawerProps(props: unknown): props is CloneProjectViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props && 'onClose' in props;
}

type CloneDepth = 'all' | 'subprocess' | 'stage' | 'process';

const DEPTH_OPTIONS: { value: CloneDepth; label: string; description: string }[] = [
  { value: 'all', label: 'Complete Clone', description: 'Project → Process → Stage → Subprocess → Task' },
  { value: 'subprocess', label: 'Up to Subprocess', description: 'Project → Process → Stage → Subprocess (no tasks)' },
  { value: 'stage', label: 'Up to Stage', description: 'Project → Process → Stage only' },
  { value: 'process', label: 'Up to Process', description: 'Project → Process only' },
];

export function CloneProjectView(props: CloneProjectViewProps | LegacyCloneProjectViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isDrawerProps(props);
  const sourceProjectId = isNewContract
    ? (props.context.sourceProjectId || props.context.projectId)
    : props.sourceProjectId;
  const sourceProjectTitle = isNewContract
    ? (props.context.sourceProjectTitle || props.context.project?.title || 'Project')
    : props.sourceProjectTitle;
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const [title, setTitle] = useState(`${sourceProjectTitle} (Copy)`);
  const [depth, setDepth] = useState<CloneDepth>('all');
  const [includeDefinitions, setIncludeDefinitions] = useState(true);
  const [includeRecords, setIncludeRecords] = useState(false);

  const { closeDrawer } = useUIStore();
  const { selectProject } = useHierarchyStore();
  const cloneNode = useCloneNode();

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeDrawer();
    }
  };

  // Fetch clone stats for display
  const { data: cloneStats } = useCloneStats(sourceProjectId);
  const includedCount = (cloneStats?.total ?? 0) - (cloneStats?.excluded ?? 0);
  const excludedCount = cloneStats?.excluded ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const result = await cloneNode.mutateAsync({
        sourceNodeId: sourceProjectId,
        targetParentId: null, // Project has no parent
        overrides: {
          title: title.trim(),
        },
        depth,
        includeTemplates: includeDefinitions, // Still use includeTemplates for API compatibility
        includeRecords,
      });

      if (onSubmit) {
        // New contract: emit typed result
        onSubmit({
          success: true,
          data: { projectId: result.node?.id || '' },
          sideEffects: [{ type: 'clone', entityType: 'project' }],
        });
      } else {
        // Legacy: auto-select and close
        if (result.node) {
          selectProject(result.node.id);
        }
        closeDrawer();
      }
    } catch (err) {
      console.error('Failed to clone project:', err);
      if (onSubmit) {
        onSubmit({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to clone project',
        });
      }
    }
  };

  return (
    <Box maw={480} mx="auto">
      {/* Header */}
      <Group gap="sm" mb="md">
        <ThemeIcon size={40} variant="light" color="blue" radius="md">
          <Copy size={20} />
        </ThemeIcon>
        <Stack gap={0}>
          <Text size="lg" fw={600}>Clone Project</Text>
          <Text size="sm" c="dimmed">"{sourceProjectTitle}"</Text>
        </Stack>
      </Group>

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Project Name */}
          <TextInput
            label="New Project Name"
            placeholder="Enter new project name..."
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            autoFocus
          />

          {/* Clone Depth */}
          <Box>
            <Group gap="xs" mb="xs">
              <Layers size={16} />
              <Text size="sm" fw={500}>Clone Depth</Text>
            </Group>
            <Radio.Group value={depth} onChange={(val) => setDepth(val as CloneDepth)}>
              <Stack gap="xs">
                {DEPTH_OPTIONS.map((option) => (
                  <Paper
                    key={option.value}
                    withBorder
                    p="sm"
                    radius="md"
                    className={`cursor-pointer transition-colors ${depth === option.value ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                    onClick={() => setDepth(option.value)}
                  >
                    <Group wrap="nowrap">
                      <Radio value={option.value} />
                      <Stack gap={0}>
                        <Text size="sm" fw={500}>{option.label}</Text>
                        <Text size="xs" c="dimmed">{option.description}</Text>
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Radio.Group>
          </Box>

          {/* Include Options */}
          <Stack gap="xs">
            {/* Include Definitions */}
            <Paper
              withBorder
              p="sm"
              radius="md"
              className={`cursor-pointer transition-colors ${includeDefinitions ? 'border-purple-500 bg-purple-50' : ''
                }`}
              onClick={() => setIncludeDefinitions(!includeDefinitions)}
            >
              <Group wrap="nowrap">
                <Checkbox
                  checked={includeDefinitions}
                  onChange={(e) => setIncludeDefinitions(e.currentTarget.checked)}
                />
                <Stack gap={2} style={{ flex: 1 }}>
                  <Group gap="xs">
                    <FileText size={16} className="text-purple-600" />
                    <Text size="sm" fw={500}>Include Record Definitions</Text>
                    {includedCount > 0 && (
                      <Badge size="xs" color="purple" variant="light">
                        {includedCount} definition{includedCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {excludedCount > 0 && (
                      <Badge size="xs" color="yellow" variant="light">
                        {excludedCount} excluded
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    Clone all non-excluded record definitions to the new project
                  </Text>
                </Stack>
              </Group>
            </Paper>

            {/* Include Records */}
            <Paper
              withBorder
              p="sm"
              radius="md"
              className={`cursor-pointer transition-colors ${includeRecords ? 'border-green-500 bg-green-50' : ''
                }`}
              onClick={() => setIncludeRecords(!includeRecords)}
            >
              <Group wrap="nowrap">
                <Checkbox
                  checked={includeRecords}
                  onChange={(e) => setIncludeRecords(e.currentTarget.checked)}
                />
                <Stack gap={2} style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Database size={16} className="text-green-600" />
                    <Text size="sm" fw={500}>Include Records</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Copy data records classified under this project's hierarchy
                  </Text>
                </Stack>
              </Group>
            </Paper>
          </Stack>

          {/* Info Box */}
          <Alert color="yellow" variant="light">
            <Text size="xs">
              <strong>Note:</strong> Task references will be cloned but will still point to the original records (unless you include records).
            </Text>
          </Alert>

          {/* Actions */}
          <Group justify="flex-end" gap="sm" pt="md" className="border-t border-slate-100">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              loading={cloneNode.isPending}
              leftSection={<Copy size={16} />}
            >
              Clone Project
            </Button>
          </Group>

          {cloneNode.isError && (
            <Text size="sm" c="red">
              Failed to clone project. Please try again.
            </Text>
          )}
        </Stack>
      </form>
    </Box>
  );
}
