/**
 * AddWorkspaceDialog
 *
 * Modal dialog for naming and saving a new custom workspace.
 * Captures the current panel arrangement and saves it as a preset.
 */

import { useState, useCallback } from 'react';
import { Folder } from 'lucide-react';

import { Modal, Button, Text, Inline } from '@autoart/ui';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface AddWorkspaceDialogProps {
    open: boolean;
    onClose: () => void;
}

export function AddWorkspaceDialog({ open, onClose }: AddWorkspaceDialogProps) {
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { saveCurrentAsWorkspace, customWorkspaces } = useWorkspaceStore();

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = name.trim();

        // Validation
        if (!trimmedName) {
            setError('Please enter a name');
            return;
        }

        if (trimmedName.length > 50) {
            setError('Name must be 50 characters or less');
            return;
        }

        // Check for duplicate names
        const isDuplicate = customWorkspaces.some(
            w => w.label.toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicate) {
            setError('A workspace with this name already exists');
            return;
        }

        // Save workspace
        saveCurrentAsWorkspace(trimmedName);

        // Reset and close
        setName('');
        setError(null);
        onClose();
    }, [name, saveCurrentAsWorkspace, customWorkspaces, onClose]);

    const handleClose = useCallback(() => {
        setName('');
        setError(null);
        onClose();
    }, [onClose]);

    return (
        <Modal
            open={open}
            onOpenChange={(isOpen) => !isOpen && handleClose()}
            title="Save Workspace"
            description="Save your current panel arrangement as a custom workspace."
            size="sm"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Preview of what will be saved */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <Inline gap="sm" align="center" className="text-slate-600">
                        <Folder size={16} className="text-slate-400" />
                        <Text size="sm">Current panel arrangement will be saved</Text>
                    </Inline>
                </div>

                {/* Name input */}
                <div>
                    <label htmlFor="workspace-name" className="block text-sm font-medium text-slate-700 mb-1">
                        Workspace Name
                    </label>
                    <input
                        id="workspace-name"
                        type="text"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            setError(null);
                        }}
                        placeholder="My Workflow"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                    />
                    {error && (
                        <p className="mt-1 text-sm text-red-600">{error}</p>
                    )}
                </div>

                {/* Actions */}
                <Inline gap="sm" justify="end" className="pt-2">
                    <Button variant="secondary" onClick={handleClose} type="button">
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit">
                        Save Workspace
                    </Button>
                </Inline>
            </form>
        </Modal>
    );
}
