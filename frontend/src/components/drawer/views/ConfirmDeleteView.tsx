import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';

interface ConfirmDeleteViewProps {
  title: string;
  message: string;
  itemName?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDeleteView({
  title,
  message,
  itemName,
  onConfirm,
}: ConfirmDeleteViewProps) {
  const { closeDrawer } = useUIStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      closeDrawer();
    } catch (err) {
      console.error('Delete action failed:', err);
      setError(err instanceof Error ? err.message : 'Delete failed. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-start gap-4 mb-6">
        <div className="shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-600" />
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
          onClick={closeDrawer}
          disabled={isDeleting}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isDeleting}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
