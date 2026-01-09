/**
 * CloneDefinitionView
 *
 * Drawer view for cloning a record definition using Mantine.
 */

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { TextInput, Button, Stack, Group, Text, Box } from '@mantine/core';
import { useUIStore } from '../../../stores/uiStore';
import type { DrawerProps, CloneDefinitionContext } from '../../../drawer/types';

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyCloneDefinitionViewProps {
  definitionName: string;
  onClone: (name: string) => Promise<void>;
}

// New contract props
type CloneDefinitionViewProps = DrawerProps<CloneDefinitionContext & { definitionName?: string; onClone?: (name: string) => Promise<void> }, { definitionId: string }>;

// Type guard to detect legacy vs new props
function isDrawerProps(props: unknown): props is CloneDefinitionViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props && 'onClose' in props;
}

export function CloneDefinitionView(props: CloneDefinitionViewProps | LegacyCloneDefinitionViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isDrawerProps(props);
  const definitionName = isNewContract
    ? (props.context.definitionName || props.context.definition?.name || 'Definition')
    : props.definitionName;
  const legacyOnClone = !isNewContract ? props.onClone : props.context.onClone;
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const { closeDrawer } = useUIStore();
  const [cloneName, setCloneName] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeDrawer();
    }
  };

  const handleClone = async () => {
    if (!cloneName.trim()) return;

    setIsCloning(true);
    try {
      if (legacyOnClone) {
        await legacyOnClone(cloneName.trim());
      }

      if (onSubmit) {
        // New contract: emit typed result
        onSubmit({
          success: true,
          data: { definitionId: '' }, // ID would come from actual clone operation
          sideEffects: [{ type: 'clone', entityType: 'definition' }],
        });
      } else {
        // Legacy: close
        setCloneName('');
        closeDrawer();
      }
    } catch (err) {
      console.error('Clone failed:', err);
      setIsCloning(false);
      if (onSubmit) {
        onSubmit({
          success: false,
          error: err instanceof Error ? err.message : 'Clone failed',
        });
      }
    }
  };

  return (
    <Box maw={480} mx="auto">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Create a new record type based on "{definitionName}". The new type will inherit all fields and styling.
        </Text>

        <TextInput
          label="New Type Name"
          placeholder="e.g., VIP Contact"
          value={cloneName}
          onChange={(e) => setCloneName(e.currentTarget.value)}
          autoFocus
        />

        <Group justify="flex-end" gap="sm" pt="md" className="border-t border-slate-100">
          <Button variant="default" onClick={handleClose} disabled={isCloning}>
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={!cloneName.trim()}
            loading={isCloning}
            leftSection={<Copy size={16} />}
          >
            Clone Type
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}
