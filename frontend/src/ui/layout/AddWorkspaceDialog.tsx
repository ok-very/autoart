/**
 * AddWorkspaceDialog
 *
 * Modal dialog for naming and saving a new custom workspace.
 * Captures the current panel arrangement and saves it as a preset.
 * Optionally scoped to a parent workspace via parentWorkspaceId.
 */

import { useState, useCallback } from 'react';
import { Folder } from 'lucide-react';

import { Modal, Button, Text, Inline } from '@autoart/ui';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { BUILT_IN_WORKSPACES } from '../../workspace/workspacePresets';
import { WORKSPACE_COLORS, BASIC_COLOR_NAMES, ALL_COLOR_NAMES, type WorkspaceColorName } from '../../workspace/workspaceColors';

interface AddWorkspaceDialogProps {
    open: boolean;
    onClose: () => void;
    parentWorkspaceId?: string;
    defaultColor?: string;
}

export function AddWorkspaceDialog({ open, onClose, parentWorkspaceId, defaultColor }: AddWorkspaceDialogProps) {
    const [name, setName] = useState('');
    const [color, setColor] = useState<WorkspaceColorName>((defaultColor as WorkspaceColorName) ?? 'slate');
    const [error, setError] = useState<string | null>(null);
    const [showAllColors, setShowAllColors] = useState(false);
    const visibleColors = showAllColors ? ALL_COLOR_NAMES : BASIC_COLOR_NAMES;

    const parentLabel = parentWorkspaceId
        ? BUILT_IN_WORKSPACES.find(w => w.id === parentWorkspaceId)?.label
        : undefined;

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

        // Check for duplicate names against BOTH built-in and custom workspaces
        // Use current store state to avoid stale closure issues
        const currentCustomWorkspaces = useWorkspaceStore.getState().customWorkspaces;
        const allWorkspaces = [...BUILT_IN_WORKSPACES, ...currentCustomWorkspaces];
        const isDuplicate = allWorkspaces.some(
            w => w.label.toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicate) {
            setError('A workspace with this name already exists');
            return;
        }

        // Save workspace with error handling
        try {
            useWorkspaceStore.getState().saveCurrentAsWorkspace(trimmedName, {
                color,
                parentWorkspaceId,
            });
            // Reset and close only on success
            setName('');
            setColor((defaultColor as WorkspaceColorName) ?? 'slate');
            setError(null);
            setShowAllColors(false);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save workspace');
        }
    }, [name, color, parentWorkspaceId, defaultColor, onClose]);

    const handleClose = useCallback(() => {
        setName('');
        setColor((defaultColor as WorkspaceColorName) ?? 'slate');
        setError(null);
        setShowAllColors(false);
        onClose();
    }, [defaultColor, onClose]);

    const title = parentLabel ? `Save to ${parentLabel}` : 'Save Workspace';
    const description = parentLabel
        ? `Save your current panel arrangement as a custom view in ${parentLabel}.`
        : 'Save your current panel arrangement as a custom workspace.';

    return (
        <Modal
            open={open}
            onOpenChange={(isOpen) => !isOpen && handleClose()}
            title={title}
            description={description}
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
                        Name
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

                {/* Color picker */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-700">
                            Color
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowAllColors(!showAllColors)}
                            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            {showAllColors ? 'Fewer' : 'More'}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {visibleColors.map((c) => {
                            const classes = WORKSPACE_COLORS[c];
                            const isSelected = c === color;
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-6 h-6 rounded-full ${classes.bg200} transition-all ${
                                        isSelected ? 'ring-2 ring-offset-1 ring-slate-500' : 'hover:ring-1 hover:ring-offset-1 hover:ring-slate-300'
                                    }`}
                                    title={c}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <Inline gap="sm" justify="end" className="pt-2">
                    <Button variant="secondary" onClick={handleClose} type="button">
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit">
                        Save
                    </Button>
                </Inline>
            </form>
        </Modal>
    );
}
