import { useState } from 'react';
import { useUIStore } from '../../../stores/uiStore';

interface CloneDefinitionViewProps {
  definitionName: string;
  onClone: (name: string) => Promise<void>;
}

export function CloneDefinitionView({ definitionName, onClone }: CloneDefinitionViewProps) {
  const { closeDrawer } = useUIStore();
  const [cloneName, setCloneName] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  const handleClone = async () => {
    if (!cloneName.trim()) return;

    setIsCloning(true);
    try {
      await onClone(cloneName.trim());
      setCloneName('');
      closeDrawer();
    } catch (err) {
      console.error('Clone failed:', err);
      setIsCloning(false);
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
            onClick={closeDrawer}
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
