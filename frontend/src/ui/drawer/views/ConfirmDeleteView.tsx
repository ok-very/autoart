/**
 * ConfirmDeleteView
 *
 * Confirmation dialog for delete operations. Uses Mantine components.
 */

import { useState } from 'react';
import { Button, Group, Text, ThemeIcon, Alert, Stack } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import type { DrawerProps, ConfirmDeleteContext } from '../../../drawer/types';

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyConfirmDeleteViewProps {
  title: string;
  message: string;
  itemName?: string;
  onConfirm: () => void | Promise<void>;
}

// New contract props
type ConfirmDeleteViewProps = DrawerProps<ConfirmDeleteContext, { deleted: boolean }>;

// Type guard to detect legacy vs new props
function isDrawerProps(props: unknown): props is ConfirmDeleteViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props;
}

export function ConfirmDeleteView(props: ConfirmDeleteViewProps | LegacyConfirmDeleteViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isDrawerProps(props);

  const title = isNewContract ? props.context.title : props.title;
  const message = isNewContract ? props.context.message : props.message;
  const itemName = isNewContract ? undefined : props.itemName;
  const onConfirmAction = isNewContract ? props.context.onConfirm : props.onConfirm;
  const confirmLabel = isNewContract ? props.context.confirmLabel : undefined;
  const cancelLabel = isNewContract ? props.context.cancelLabel : undefined;
  const variant = isNewContract ? props.context.variant : 'danger';
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const { closeDrawer } = useUIStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeDrawer();
    }
  };

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirmAction();

      if (onSubmit) {
        // New contract: emit typed result
        onSubmit({
          success: true,
          data: { deleted: true },
          sideEffects: [{ type: 'delete', entityType: 'record' }],
        });
      } else {
        // Legacy: close
        closeDrawer();
      }
    } catch (err) {
      console.error('Delete action failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Delete failed. Please try again.';
      setError(errorMessage);
      setIsDeleting(false);

      if (onSubmit) {
        onSubmit({
          success: false,
          error: errorMessage,
        });
      }
    }
  };

  const isDanger = variant === 'danger';
  const color = isDanger ? 'red' : 'yellow';

  return (
    <div className="max-w-lg mx-auto">
      <Stack gap="lg">
        {/* Header */}
        <Group align="flex-start" gap="md">
          <ThemeIcon size="xl" radius="xl" variant="light" color={color}>
            <AlertTriangle size={24} />
          </ThemeIcon>
          <div className="flex-1">
            <Text size="lg" fw={500} mb="xs">{title}</Text>
            <Text size="sm" c="dimmed">{message}</Text>
            {itemName && (
              <Text size="sm" fw={500} mt="sm" className="bg-slate-100 px-3 py-1.5 rounded inline-block">
                {itemName}
              </Text>
            )}
          </div>
        </Group>

        {/* Error */}
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {/* Actions */}
        <Group justify="flex-end" gap="sm" pt="md" className="border-t border-slate-100">
          <Button
            variant="default"
            onClick={handleClose}
            disabled={isDeleting}
          >
            {cancelLabel || 'Cancel'}
          </Button>
          <Button
            color={color}
            onClick={handleConfirm}
            loading={isDeleting}
          >
            {confirmLabel || 'Delete'}
          </Button>
        </Group>
      </Stack>
    </div>
  );
}
