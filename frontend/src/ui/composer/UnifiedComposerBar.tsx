/**
 * UnifiedComposerBar
 *
 * The context-aware inline composer bar for declaring Actions.
 * Fixed at the bottom of the screen, shows:
 * - Derived context (from current selection/navigation)
 * - Title input for quick declaration
 * - Event preview (what will happen)
 * - Suggestions (proactive assistance)
 *
 * Key principles:
 * - Context is DERIVED, not selected
 * - Events are PRIMARY - users see consequences
 * - Soft-intrinsic typing - no explicit "Task vs Subtask" dropdown
 */

import { clsx } from 'clsx';
import {
    ChevronDown,
    ChevronUp,
    Send,
    Loader2,
    Wand2,
    X,
    Plus,
    Lightbulb,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';

import { Button } from '@autoart/ui';

import {
    useCompose,
    useRecordDefinitions,
    generateMockComposerSuggestions,
    type Suggestion,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';

import { ContextIndicator, useDerivedContext } from './ContextIndicator';
import { EventPreview, buildPendingEvents } from './EventPreview';
import { SuggestionChip } from '../suggestions';

export interface UnifiedComposerBarProps {
    /** Additional className */
    className?: string;
    /** Whether to show the bar (can be externally controlled) */
    visible?: boolean;
    /** Callback when an action is created */
    onActionCreated?: (actionId: string) => void;
}

/**
 * UnifiedComposerBar Component
 */
export function UnifiedComposerBar({
    className,
    visible = true,
    onActionCreated,
}: UnifiedComposerBarProps) {
    // State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [expanded, setExpanded] = useState(false);
    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
    const [showEventPreview, setShowEventPreview] = useState(true);
    const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

    // Hooks
    const derivedContext = useDerivedContext();
    const compose = useCompose();
    const { data: allDefinitions } = useRecordDefinitions();

    // Store
    const { activeProjectId } = useUIStore();

    // Filter to action recipes only
    const actionRecipes = useMemo(() => {
        if (!allDefinitions) return [];
        return allDefinitions.filter((d) => d.kind === 'action_recipe');
    }, [allDefinitions]);

    // Auto-select first recipe (Task by default)
    useEffect(() => {
        if (actionRecipes.length > 0 && !selectedRecipeId) {
            // Prefer "Task" recipe if available
            const taskRecipe = actionRecipes.find((r) => r.name.toLowerCase() === 'task');
            setSelectedRecipeId(taskRecipe?.id || actionRecipes[0].id);
        }
    }, [actionRecipes, selectedRecipeId]);

    const selectedRecipe = useMemo(() => {
        if (!selectedRecipeId || !actionRecipes.length) return null;
        return actionRecipes.find((r) => r.id === selectedRecipeId) || null;
    }, [selectedRecipeId, actionRecipes]);

    // Build pending events for preview
    const pendingEvents = useMemo(() => {
        if (!selectedRecipe || !title.trim()) return [];
        return buildPendingEvents({
            actionType: selectedRecipe.name,
            title: title.trim(),
            description: description.trim() || undefined,
        });
    }, [selectedRecipe, title, description]);

    // Generate suggestions based on title input
    const suggestions = useMemo(() => {
        if (!derivedContext.contextId || title.length < 3) return [];
        const allSuggestions = generateMockComposerSuggestions(title, derivedContext.contextId);
        // Filter out dismissed suggestions
        return allSuggestions.filter((s) => !dismissedSuggestions.has(s.id));
    }, [title, derivedContext.contextId, dismissedSuggestions]);

    // Handle suggestion acceptance
    const handleAcceptSuggestion = useCallback((suggestion: Suggestion) => {
        // For link/reference suggestions, we could auto-add the reference
        // For similar suggestions, we could show a comparison
        console.log('Accept suggestion:', suggestion);
        setDismissedSuggestions((prev) => new Set([...prev, suggestion.id]));
    }, []);

    // Handle suggestion dismissal
    const handleDismissSuggestion = useCallback((suggestion: Suggestion) => {
        setDismissedSuggestions((prev) => new Set([...prev, suggestion.id]));
    }, []);

    // Submit handler
    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim() || !derivedContext.contextId || !selectedRecipe) return;

        try {
            const result = await compose.mutateAsync({
                action: {
                    contextId: derivedContext.contextId,
                    contextType: derivedContext.contextType,
                    type: selectedRecipe.name,
                    fieldBindings: [{ fieldKey: 'title' }],
                    ...(derivedContext.parentActionId ? { parentActionId: derivedContext.parentActionId } : {}),
                },
                fieldValues: [
                    { fieldName: 'title', value: title.trim() },
                    ...(description.trim() ? [{ fieldName: 'description', value: description.trim() }] : []),
                ],
            });

            // Reset form on success
            setTitle('');
            setDescription('');
            setExpanded(false);

            // Notify parent
            if (onActionCreated && result.action?.id) {
                onActionCreated(result.action.id);
            }
        } catch (err) {
            console.error('Failed to compose action:', err);
        }
    }, [title, description, derivedContext, selectedRecipe, compose, onActionCreated]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + Enter to submit
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (title.trim() && derivedContext.contextId && selectedRecipe && !compose.isPending) {
                    e.preventDefault();
                    handleSubmit();
                }
            }
            // Escape to collapse
            if (e.key === 'Escape' && expanded) {
                setExpanded(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [title, derivedContext.contextId, selectedRecipe, compose.isPending, expanded, handleSubmit]);

    const isLoading = compose.isPending;
    const canSubmit = title.trim() && derivedContext.contextId && selectedRecipe && !isLoading;
    const hasContent = title.trim() || description.trim();

    // Don't render if no project is active
    if (!activeProjectId || !visible) {
        return null;
    }

    return (
        <div className={clsx(
            'fixed bottom-0 left-0 right-0 z-40',
            'bg-white border-t border-slate-200 shadow-lg',
            'transition-all duration-200',
            className
        )}>
            {/* Expand/Collapse Toggle */}
            <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="absolute -top-8 left-1/2 -translate-x-1/2 px-4 py-1 bg-white border border-b-0 border-slate-200 rounded-t-lg text-slate-500 hover:text-slate-700 transition-colors"
            >
                {expanded ? (
                    <ChevronDown size={16} />
                ) : (
                    <ChevronUp size={16} />
                )}
            </button>

            <div className={clsx(
                'max-w-5xl mx-auto px-4 py-3',
                expanded && 'pb-4'
            )}>
                {/* Main Bar */}
                <form onSubmit={handleSubmit}>
                    <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                            <Wand2 size={16} />
                        </div>

                        {/* Context Indicator */}
                        <div className="shrink-0">
                            <ContextIndicator size="sm" />
                        </div>

                        {/* Separator */}
                        <div className="shrink-0 w-px h-6 bg-slate-200" />

                        {/* Title Input */}
                        <div className="flex-1 min-w-0">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={`New ${selectedRecipe?.name || 'Task'}...`}
                                className={clsx(
                                    'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg',
                                    'focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100',
                                    'placeholder:text-slate-400'
                                )}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={!canSubmit}
                            variant="primary"
                            size="sm"
                            className="shrink-0"
                            leftSection={isLoading ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Send size={14} />
                            )}
                        >
                            Declare
                        </Button>

                        {/* Expand Button (when collapsed and has content) */}
                        {!expanded && hasContent && (
                            <button
                                type="button"
                                onClick={() => setExpanded(true)}
                                className="shrink-0 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    </div>

                    {/* Expanded Section */}
                    {expanded && (
                        <div className="mt-4 space-y-4">
                            {/* Recipe Selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500 shrink-0">
                                    Type:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {actionRecipes.map((recipe) => {
                                        const isSelected = selectedRecipeId === recipe.id;
                                        const styling = recipe.styling as { icon?: string } | undefined;
                                        return (
                                            <button
                                                key={recipe.id}
                                                type="button"
                                                onClick={() => setSelectedRecipeId(recipe.id)}
                                                className={clsx(
                                                    'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                                                    isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                                                )}
                                            >
                                                {styling?.icon && <span className="mr-1">{styling.icon}</span>}
                                                {recipe.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Description Input */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Add details..."
                                    className={clsx(
                                        'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg',
                                        'focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100',
                                        'placeholder:text-slate-400 resize-none'
                                    )}
                                    rows={2}
                                    disabled={isLoading}
                                />
                            </div>

                            {/* Event Preview */}
                            {pendingEvents.length > 0 && showEventPreview && (
                                <div className="relative">
                                    <EventPreview
                                        events={pendingEvents}
                                        size="sm"
                                        collapsedLimit={3}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowEventPreview(false)}
                                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}

                            {/* Suggestions */}
                            {suggestions.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                                        <Lightbulb size={12} />
                                        <span>Suggestions:</span>
                                    </div>
                                    {suggestions.slice(0, 3).map((suggestion) => (
                                        <SuggestionChip
                                            key={suggestion.id}
                                            suggestion={suggestion}
                                            onClick={() => handleAcceptSuggestion(suggestion)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Keyboard Shortcut Hint */}
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>
                                    Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">Ctrl+Enter</kbd> to declare
                                </span>
                                {derivedContext.parentActionId && (
                                    <span className="text-amber-600">
                                        Creating as subtask
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </form>

                {/* Error Display */}
                {compose.error && (
                    <div className="mt-2 text-xs text-red-600">
                        {(compose.error as Error).message || 'Failed to create action'}
                    </div>
                )}
            </div>
        </div>
    );
}

export default UnifiedComposerBar;
