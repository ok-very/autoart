/**
 * QuickDeclareModal
 *
 * Transient modal for quick action/task declaration.
 * Extracted from InspectorFooterComposer to be globally accessible via hotkey.
 *
 * Features:
 * - Recipe/action type selector
 * - Title + description inputs
 * - Context derived from current selection
 * - Keyboard: Enter to submit, Escape to close (handled by Modal)
 */

import { clsx } from 'clsx';
import { Send, Loader2 } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

import { useCompose, useRecordDefinitions, useNode, useAction, useSubprocesses } from '../../../api/hooks';
import { useUIStore } from '../../../stores/uiStore';

interface QuickDeclareModalProps {
    onClose: () => void;
}

export function QuickDeclareModal({ onClose }: QuickDeclareModalProps) {
    const { selection, activeProjectId } = useUIStore();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

    const compose = useCompose();
    const { data: allDefinitions } = useRecordDefinitions();
    const { data: subprocesses } = useSubprocesses(activeProjectId);

    // Get context from selection
    const nodeId = selection?.type === 'node' ? selection.id : null;
    const actionId = selection?.type === 'action' ? selection.id : null;

    const { data: selectedNode } = useNode(nodeId);
    const { data: selectedAction } = useAction(actionId);

    // Filter to action recipes only
    const actionRecipes = useMemo(() => {
        if (!allDefinitions) return [];
        return allDefinitions.filter((d) => d.kind === 'action_recipe');
    }, [allDefinitions]);

    // Auto-select first recipe
    useEffect(() => {
        if (actionRecipes.length > 0 && !selectedRecipeId) {
            setSelectedRecipeId(actionRecipes[0].id);
        }
    }, [actionRecipes, selectedRecipeId]);

    const selectedRecipe = useMemo(() => {
        if (!selectedRecipeId || !actionRecipes.length) return null;
        return actionRecipes.find((r) => r.id === selectedRecipeId) || null;
    }, [selectedRecipeId, actionRecipes]);

    // Derive context ID from selection
    const contextId = useMemo(() => {
        if (selectedNode) {
            // If node is a subprocess, use it directly; otherwise find parent subprocess
            if (selectedNode.type === 'subprocess' || selectedNode.type === 'stage') {
                return selectedNode.id;
            }
            // For tasks, use their parent (which should be a subprocess)
            return selectedNode.parent_id || selectedNode.id;
        }
        if (selectedAction) {
            return selectedAction.contextId;
        }
        // Fallback to first subprocess in project
        return subprocesses?.[0]?.id || null;
    }, [selectedNode, selectedAction, subprocesses]);

    const contextType = useMemo(() => {
        if (selectedNode) {
            if (selectedNode.type === 'stage') return 'stage' as const;
            return 'subprocess' as const;
        }
        if (selectedAction) {
            return selectedAction.contextType;
        }
        return 'subprocess' as const;
    }, [selectedNode, selectedAction]);

    // Handle form submission
    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim() || !contextId || !selectedRecipe) return;

        try {
            await compose.mutateAsync({
                action: {
                    contextId,
                    contextType,
                    type: selectedRecipe.name,
                    fieldBindings: [{ fieldKey: 'title' }],
                },
                fieldValues: [
                    { fieldName: 'title', value: title.trim() },
                    ...(description ? [{ fieldName: 'description', value: description.trim() }] : []),
                ],
            });

            // Close modal on success
            onClose();
        } catch (err) {
            console.error('Failed to compose action:', err);
        }
    };

    // Handle Enter key in title input (submit if not in textarea)
    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const isLoading = compose.isPending;
    const canSubmit = title.trim() && contextId && selectedRecipe && !isLoading;

    // Determine context display name
    const contextDisplay = useMemo(() => {
        if (selectedNode) return selectedNode.title;
        if (selectedAction) return `via ${selectedAction.type}`;
        if (subprocesses?.[0]) {
            const fieldBindings = subprocesses[0].fieldBindings as { fieldKey: string; value?: unknown }[];
            const titleBinding = fieldBindings?.find((b) => b.fieldKey === 'title');
            return String(titleBinding?.value || 'Subprocess');
        }
        return null;
    }, [selectedNode, selectedAction, subprocesses]);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-800">Quick Declare</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Create a new action quickly
                    {contextDisplay && (
                        <span className="text-slate-600 font-medium"> → {contextDisplay}</span>
                    )}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Recipe Selector */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                        Action Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {actionRecipes.map((recipe) => {
                            const isSelected = selectedRecipeId === recipe.id;
                            const styling = recipe.styling as { icon?: string } | undefined;
                            return (
                                <button
                                    key={recipe.id}
                                    type="button"
                                    onClick={() => setSelectedRecipeId(recipe.id)}
                                    className={clsx(
                                        'px-3 py-1.5 text-sm font-medium rounded-full border transition-colors',
                                        isSelected
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                                    )}
                                >
                                    {styling?.icon && <span className="mr-1">{styling.icon}</span>}
                                    {recipe.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Title Input */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                        Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={handleTitleKeyDown}
                        placeholder={`New ${selectedRecipe?.name || 'Task'}...`}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        disabled={isLoading}
                        autoFocus
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                        Description <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add details..."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
                        rows={3}
                        disabled={isLoading}
                    />
                </div>

                {/* Error display */}
                {compose.error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {(compose.error as Error).message || 'Failed to create action'}
                    </div>
                )}

                {/* No context warning */}
                {!contextId && (
                    <div className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        No context available. Select a subprocess or task first, or ensure a project is active.
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className={clsx(
                            'px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors',
                            canSubmit
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        )}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Create
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Keyboard hint */}
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">Enter</kbd> to create, <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">Esc</kbd> to cancel
            </div>
        </div>
    );
}
