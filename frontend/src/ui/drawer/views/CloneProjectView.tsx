/**
 * CloneProjectView
 *
 * Drawer view for cloning a project with configurable depth.
 */

import { useState } from 'react';
import { Copy, FileText, Database, Layers } from 'lucide-react';
import { TextInput } from '../../atoms/TextInput';
import { Button } from '../../atoms/Button';
import { Stack } from '../../atoms/Stack';
import { Inline } from '../../atoms/Inline';
import { Text } from '../../atoms/Text';
import { Alert } from '../../atoms/Alert';
import { Badge } from '../../atoms/Badge';
import { Checkbox } from '../../atoms/Checkbox';
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
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <Inline gap="sm" className="mb-4">
        <div className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg">
          <Copy size={20} />
        </div>
        <Stack gap="none">
          <Text size="lg" weight="semibold">Clone Project</Text>
          <Text size="sm" color="muted">"{sourceProjectTitle}"</Text>
        </Stack>
      </Inline>

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
          <div>
            <Inline gap="xs" className="mb-2">
              <Layers size={16} />
              <Text size="sm" weight="medium">Clone Depth</Text>
            </Inline>
            <Stack gap="xs">
              {DEPTH_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={`bg-white border rounded-lg p-3 cursor-pointer transition-colors ${depth === option.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                    }`}
                  onClick={() => setDepth(option.value)}
                >
                  <Inline wrap={false}>
                    <input
                      type="radio"
                      name="cloneDepth"
                      value={option.value}
                      checked={depth === option.value}
                      onChange={() => setDepth(option.value)}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <Stack gap="none">
                      <Text size="sm" weight="medium">{option.label}</Text>
                      <Text size="xs" color="muted">{option.description}</Text>
                    </Stack>
                  </Inline>
                </div>
              ))}
            </Stack>
          </div>

          {/* Include Options */}
          <Stack gap="xs">
            {/* Include Definitions */}
            <div
              className={`bg-white border rounded-lg p-3 cursor-pointer transition-colors ${includeDefinitions ? 'border-purple-500 bg-purple-50' : 'border-slate-200'
                }`}
              onClick={() => setIncludeDefinitions(!includeDefinitions)}
            >
              <Inline wrap={false}>
                <Checkbox
                  checked={includeDefinitions}
                  onChange={(checked) => setIncludeDefinitions(checked)}
                />
                <Stack gap="none" className="flex-1">
                  <Inline gap="xs">
                    <FileText size={16} className="text-purple-600" />
                    <Text size="sm" weight="medium">Include Record Definitions</Text>
                    {includedCount > 0 && (
                      <Badge variant="process">
                        {includedCount} definition{includedCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {excludedCount > 0 && (
                      <Badge variant="warning">
                        {excludedCount} excluded
                      </Badge>
                    )}
                  </Inline>
                  <Text size="xs" color="muted">
                    Clone all non-excluded record definitions to the new project
                  </Text>
                </Stack>
              </Inline>
            </div>

            {/* Include Records */}
            <div
              className={`bg-white border rounded-lg p-3 cursor-pointer transition-colors ${includeRecords ? 'border-green-500 bg-green-50' : 'border-slate-200'
                }`}
              onClick={() => setIncludeRecords(!includeRecords)}
            >
              <Inline wrap={false}>
                <Checkbox
                  checked={includeRecords}
                  onChange={(checked) => setIncludeRecords(checked)}
                />
                <Stack gap="none" className="flex-1">
                  <Inline gap="xs">
                    <Database size={16} className="text-green-600" />
                    <Text size="sm" weight="medium">Include Records</Text>
                  </Inline>
                  <Text size="xs" color="muted">
                    Copy data records classified under this project's hierarchy
                  </Text>
                </Stack>
              </Inline>
            </div>
          </Stack>

          {/* Info Box */}
          <Alert variant="warning">
            <Text size="xs">
              <strong>Note:</strong> Task references will be cloned but will still point to the original records (unless you include records).
            </Text>
          </Alert>

          {/* Actions */}
          <Inline justify="end" gap="sm" className="pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || cloneNode.isPending}
              leftSection={<Copy size={16} />}
            >
              {cloneNode.isPending ? 'Cloning...' : 'Clone Project'}
            </Button>
          </Inline>

          {cloneNode.isError && (
            <Text size="sm" color="error">
              Failed to clone project. Please try again.
            </Text>
          )}
        </Stack>
      </form>
    </div>
  );
}
