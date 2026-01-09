import { useState } from 'react';
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
    <div className="max-w-lg mx-auto">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Create a new record type based on "{definitionName}". The new type will inherit all fields and styling.
        </p>
        <div>
          <label htmlFor="cloneName" className="block text-sm font-medium text-slate-700 mb-1">
            New Type Name
          </label>
          <input
            id="cloneName"
            type="text"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="e.g., VIP Contact"
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={handleClose}
            disabled={isCloning}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            disabled={!cloneName.trim() || isCloning}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCloning ? 'Cloning...' : 'Clone Type'}
          </button>
        </div>
      </div>
    </div>
  );
}
