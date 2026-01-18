/**
 * ConfirmDeleteView
 *
 * Confirmation dialog for delete operations. Uses bespoke components.
 */

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import { useUIStore } from '@/stores';

import type { DrawerProps, ConfirmDeleteContext } from '../../../drawer/types';
import { Alert } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';



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

  return (
    <div className="max-w-lg mx-auto">
      <Stack gap="lg">
        {/* Header */}
        <Inline gap="md" align="start">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <Text size="lg" weight="medium" className="mb-1">{title}</Text>
            <Text size="sm" color="muted">{message}</Text>
            {itemName && (
              <Text size="sm" weight="medium" className="mt-2 bg-slate-100 px-3 py-1.5 rounded inline-block">
                {itemName}
              </Text>
            )}
          </div>
        </Inline>

        {/* Error */}
        {error && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        {/* Actions */}
        <Inline justify="end" gap="sm" className="pt-4 border-t border-slate-100">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isDeleting}
          >
            {cancelLabel || 'Cancel'}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : (confirmLabel || 'Delete')}
          </Button>
        </Inline>
      </Stack>
    </div>
  );
}
