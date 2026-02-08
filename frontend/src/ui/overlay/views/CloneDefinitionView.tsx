/**
 * CloneDefinitionView
 *
 * Overlay view for cloning a record definition using bespoke components.
 */

import { Copy } from 'lucide-react';
import { useState } from 'react';

import { useUIStore } from '@/stores';

import type { OverlayProps, CloneDefinitionContext } from '../../../overlay/types';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { TextInput } from '@autoart/ui';

// Legacy props interface (deprecated - use OverlayProps)
interface LegacyCloneDefinitionViewProps {
  definitionName: string;
  onClone: (name: string) => Promise<void>;
}

// New contract props
type CloneDefinitionViewProps = OverlayProps<CloneDefinitionContext & { definitionName?: string; onClone?: (name: string) => Promise<void> }, { definitionId: string }>;

// Type guard to detect legacy vs new props
function isOverlayProps(props: unknown): props is CloneDefinitionViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props && 'onClose' in props;
}

export function CloneDefinitionView(props: CloneDefinitionViewProps | LegacyCloneDefinitionViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isOverlayProps(props);
  const definitionName = isNewContract
    ? (props.context.definitionName || props.context.definition?.name || 'Definition')
    : props.definitionName;
  const legacyOnClone = !isNewContract ? props.onClone : props.context.onClone;
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const { closeOverlay } = useUIStore();
  const [cloneName, setCloneName] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeOverlay();
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
          sideEffects: [{ type: 'clone', entityKind: 'definition' }],
        });
      } else {
        // Legacy: close
        setCloneName('');
        closeOverlay();
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

        <Inline justify="end" gap="sm" className="pt-4 border-t border-ws-panel-border">
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
