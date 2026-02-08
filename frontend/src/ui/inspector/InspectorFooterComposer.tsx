/**
 * InspectorFooterComposer
 *
 * Always-visible footer in the unified inspector for quick action declaration.
 * Derives compose context from the current selection.
 *
 * Features:
 * - Collapsed mode: Quick title input with send button
 * - Expanded mode: Title + description + arrangement picker
 * - Context auto-derived from selection (node/record/action)
 */

import { clsx } from 'clsx';
import { Plus, ChevronUp, ChevronDown, Send, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';

import { useCompose, useRecordDefinitions, useNode, useAction, useSubprocesses } from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';

export function InspectorFooterComposer() {
    const {
        selection,
        activeProjectId,
        inspectorComposerExpanded,
        setInspectorComposerExpanded
    } = useUIStore();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [userArrangementId, setUserArrangementId] = useState<string | null>(null);

    const compose = useCompose();
    const { data: allDefinitions } = useRecordDefinitions();
    const { data: subprocesses } = useSubprocesses(activeProjectId);

    // Get context from selection
    const nodeId = selection?.type === 'node' ? selection.id : null;
    const actionId = selection?.type === 'action' ? selection.id : null;

    const { data: selectedNode } = useNode(nodeId);
    const { data: selectedAction } = useAction(actionId);

    // Filter to action arrangements only
    const actionArrangements = useMemo(() => {
        if (!allDefinitions) return [];
        return allDefinitions.filter((d) => d.definition_kind === 'action_arrangement');
    }, [allDefinitions]);

    // Derive default arrangement ID (first arrangement)
    const defaultArrangementId = useMemo(() => actionArrangements[0]?.id ?? null, [actionArrangements]);

    // Effective arrangement selection (user choice or default)
    const selectedArrangementId = userArrangementId ?? defaultArrangementId;

    const selectedArrangement = useMemo(() => {
        if (!selectedArrangementId || !actionArrangements.length) return null;
        return actionArrangements.find((r) => r.id === selectedArrangementId) || null;
    }, [selectedArrangementId, actionArrangements]);

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
        if (!title.trim() || !contextId || !selectedArrangement) return;

        try {
            await compose.mutateAsync({
                action: {
                    contextId,
                    contextType,
                    type: selectedArrangement.name,
                    fieldBindings: [{ fieldKey: 'title' }],
                },
                fieldValues: [
                    { fieldName: 'title', value: title.trim() },
                    ...(description ? [{ fieldName: 'description', value: description.trim() }] : []),
                ],
            });

            // Reset form on success
            setTitle('');
            setDescription('');
            setInspectorComposerExpanded(false);
        } catch (err) {
            console.error('Failed to compose action:', err);
        }
    };

    // Handle Enter key in title input
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !inspectorComposerExpanded) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const isLoading = compose.isPending;
    const canSubmit = title.trim() && contextId && selectedArrangement && !isLoading;

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
        <div className="border-t border-ws-panel-border bg-ws-panel-bg shrink-0">
            {/* Collapse/Expand Toggle */}
            <button
                onClick={() => setInspectorComposerExpanded(!inspectorComposerExpanded)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-ws-text-secondary hover:text-ws-text-secondary hover:bg-ws-bg transition-colors"
            >
                <div className="flex items-center gap-1.5">
                    <Plus size={14} />
                    <span className="font-medium">Quick Declare</span>
                    {contextDisplay && (
                        <span className="text-ws-muted">→ {contextDisplay}</span>
                    )}
                </div>
                {inspectorComposerExpanded ? (
                    <ChevronDown size={14} />
                ) : (
                    <ChevronUp size={14} />
                )}
            </button>

            {/* Composer Form */}
            <form onSubmit={handleSubmit} className="px-4 pb-4">
                {/* Title Input (always visible) */}
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`New ${selectedArrangement?.name || 'Task'}...`}
                        className="flex-1 px-3 py-2 text-sm border border-ws-panel-border rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className={clsx(
                            'p-2 rounded-lg transition-colors',
                            canSubmit
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-slate-100 text-ws-muted cursor-not-allowed'
                        )}
                    >
                        {isLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Send size={16} />
                        )}
                    </button>
                </div>

                {/* Expanded Section */}
                {inspectorComposerExpanded && (
                    <div className="mt-3 space-y-3">
                        {/* Arrangement Selector */}
                        <div>
                            <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                Action Type
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {actionArrangements.map((arrangement) => {
                                    const isSelected = selectedArrangementId === arrangement.id;
                                    const styling = arrangement.styling as { icon?: string } | undefined;
                                    return (
                                        <button
                                            key={arrangement.id}
                                            type="button"
                                            onClick={() => setUserArrangementId(arrangement.id)}
                                            className={clsx(
                                                'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                                                isSelected
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-ws-panel-bg text-ws-text-secondary border-ws-panel-border hover:border-blue-300'
                                            )}
                                        >
                                            {styling?.icon && <span className="mr-1">{styling.icon}</span>}
                                            {arrangement.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-medium text-ws-text-secondary mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add details..."
                                className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
                                rows={2}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Context indicator */}
                        {contextDisplay && (
                            <div className="text-xs text-ws-muted">
                                Creating in: <span className="text-ws-text-secondary font-medium">{contextDisplay}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Error display */}
                {compose.error && (
                    <div className="mt-2 text-xs text-red-600">
                        {(compose.error as Error).message || 'Failed to create action'}
                    </div>
                )}
            </form>
        </div>
    );
}

export default InspectorFooterComposer;
