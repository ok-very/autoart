import { useState } from 'react';
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

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-start gap-4 mb-6">
        <div className={`shrink-0 w-12 h-12 ${isDanger ? 'bg-red-100' : 'bg-amber-100'} rounded-full flex items-center justify-center`}>
          <AlertTriangle size={24} className={isDanger ? 'text-red-600' : 'text-amber-600'} />
        </div>
        <div>
          <h4 className="text-lg font-medium text-slate-900 mb-2">{title}</h4>
          <p className="text-sm text-slate-600">{message}</p>
          {itemName && (
            <p className="mt-3 text-sm font-medium text-slate-900 bg-slate-100 px-3 py-1.5 rounded inline-block">
              {itemName}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={handleClose}
          disabled={isDeleting}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {cancelLabel || 'Cancel'}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isDeleting}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 transition-colors ${isDanger
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-amber-600 hover:bg-amber-700'
            }`}
        >
          {isDeleting ? 'Deleting...' : (confirmLabel || 'Delete')}
        </button>
      </div>
    </div>
  );
}
