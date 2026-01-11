/**
 * CloneDefinitionView
 *
 * Drawer view for cloning a record definition using bespoke components.
 */

import { Copy } from 'lucide-react';
import { useState } from 'react';

import { useUIStore } from '@/stores';

import type { DrawerProps, CloneDefinitionContext } from '../../../drawer/types';
import { Button } from '../../atoms/Button';
import { Inline } from '../../atoms/Inline';
import { Stack } from '../../atoms/Stack';
import { Text } from '../../atoms/Text';
import { TextInput } from '../../atoms/TextInput';

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
    <div className="max-w-lg mx-auto">
      <Stack gap="md">
        <Text size="sm" color="muted">
          Create a new record type based on "{definitionName}". The new type will inherit all fields and styling.
        </Text>

        <TextInput
          label="New Type Name"
          placeholder="e.g., VIP Contact"
          value={cloneName}
          onChange={(e) => setCloneName(e.currentTarget.value)}
          autoFocus
        />

        <Inline justify="end" gap="sm" className="pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={handleClose} disabled={isCloning}>
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={!cloneName.trim() || isCloning}
            leftSection={<Copy size={16} />}
          >
            {isCloning ? 'Cloning...' : 'Clone Type'}
          </Button>
        </Inline>
      </Stack>
    </div>
  );
}
