/**
 * SuggestionPopover
 *
 * Displays proactive suggestions based on context.
 * Can be used in the composer bar, email view, or inspector.
 *
 * Shows suggestions like:
 * - "Link to Record X?"
 * - "Similar to Action Y from yesterday?"
 * - "This email mentions a deadline - create a reminder?"
 */

import { clsx } from 'clsx';
import {
    Link2,
    History,
    Target,
    FileText,
    Lightbulb,
    X,
    ChevronRight,
    Sparkles,
} from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@autoart/ui';

import type { Suggestion, SuggestionType } from '../../api/hooks/suggestions';

export interface SuggestionPopoverProps {
    /** Suggestions to display */
    suggestions: Suggestion[];
    /** Whether the popover is loading */
    isLoading?: boolean;
    /** Callback when a suggestion is accepted */
    onAccept?: (suggestion: Suggestion) => void;
    /** Callback when a suggestion is dismissed */
    onDismiss?: (suggestion: Suggestion) => void;
    /** Callback to dismiss all suggestions */
    onDismissAll?: () => void;
    /** Maximum suggestions to show */
    maxVisible?: number;
    /** Size variant */
    size?: 'sm' | 'md';
    /** Additional className */
    className?: string;
}

/**
 * Suggestion type configuration
 */
const typeConfig: Record<SuggestionType, {
    icon: typeof Link2;
    colorClass: string;
    bgClass: string;
    label: string;
}> = {
    link: {
        icon: Link2,
        colorClass: 'text-blue-600',
        bgClass: 'bg-blue-50',
        label: 'Link',
    },
    similar: {
        icon: History,
        colorClass: 'text-purple-600',
        bgClass: 'bg-purple-50',
        label: 'Similar',
    },
    action: {
        icon: Target,
        colorClass: 'text-green-600',
        bgClass: 'bg-green-50',
        label: 'Action',
    },
    reference: {
        icon: FileText,
        colorClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        label: 'Reference',
    },
};

/**
 * Single suggestion item
 */
/**
 * Fallback config for unknown suggestion types
 */
const fallbackConfig = {
    icon: Lightbulb,
    colorClass: 'text-slate-600',
    bgClass: 'bg-slate-50',
    label: 'Suggestion',
};

function SuggestionItem({
    suggestion,
    size = 'sm',
    onAccept,
    onDismiss,
}: {
    suggestion: Suggestion;
    size?: 'sm' | 'md';
    onAccept?: () => void;
    onDismiss?: () => void;
}) {
    const config = typeConfig[suggestion.type] || fallbackConfig;
    const Icon = config.icon;

    const confidencePercent = Math.round(suggestion.confidence * 100);

    return (
        <div className={clsx(
            'group flex items-start gap-2 p-2 rounded-lg transition-colors',
            'hover:bg-slate-50',
            size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
            {/* Icon */}
            <div className={clsx(
                'shrink-0 rounded-lg flex items-center justify-center',
                config.bgClass,
                size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'
            )}>
                <Icon size={size === 'sm' ? 12 : 14} className={config.colorClass} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-700">
                        {suggestion.title}
                    </span>
                    {confidencePercent >= 80 && (
                        <Sparkles size={10} className="text-amber-500" />
                    )}
                </div>
                <p className="text-slate-500 truncate">
                    {suggestion.description}
                </p>
                {suggestion.targetEntityTitle && (
                    <p className="text-slate-400 truncate mt-0.5">
                        {suggestion.targetEntityTitle}
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onAccept && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAccept();
                        }}
                        className={clsx(
                            'p-1 rounded transition-colors',
                            config.bgClass,
                            config.colorClass,
                            'hover:opacity-80'
                        )}
                        title="Accept suggestion"
                    >
                        <ChevronRight size={12} />
                    </button>
                )}
                {onDismiss && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDismiss();
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        title="Dismiss"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * SuggestionPopover Component
 */
export function SuggestionPopover({
    suggestions,
    isLoading = false,
    onAccept,
    onDismiss,
    onDismissAll,
    maxVisible = 3,
    size = 'sm',
    className,
}: SuggestionPopoverProps) {
    const visibleSuggestions = useMemo(() => {
        return suggestions.slice(0, maxVisible);
    }, [suggestions, maxVisible]);

    const remainingCount = suggestions.length - maxVisible;

    // Empty state
    if (!isLoading && suggestions.length === 0) {
        return null;
    }

    // Loading state
    if (isLoading) {
        return (
            <div className={clsx(
                'flex items-center gap-2 px-3 py-2 text-slate-400',
                size === 'sm' ? 'text-xs' : 'text-sm',
                className
            )}>
                <Lightbulb size={14} className="animate-pulse" />
                <span>Looking for suggestions...</span>
            </div>
        );
    }

    return (
        <div className={clsx(
            'bg-white border border-slate-200 rounded-lg shadow-sm',
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lightbulb size={12} />
                    <span>Suggestions</span>
                    <Badge variant="neutral" size="xs">
                        {suggestions.length}
                    </Badge>
                </div>
                {onDismissAll && (
                    <button
                        type="button"
                        onClick={onDismissAll}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Dismiss all
                    </button>
                )}
            </div>

            {/* Suggestions list */}
            <div className="p-1">
                {visibleSuggestions.map((suggestion) => (
                    <SuggestionItem
                        key={suggestion.id}
                        suggestion={suggestion}
                        size={size}
                        onAccept={onAccept ? () => onAccept(suggestion) : undefined}
                        onDismiss={onDismiss ? () => onDismiss(suggestion) : undefined}
                    />
                ))}

                {/* More suggestions indicator */}
                {remainingCount > 0 && (
                    <div className="px-2 py-1 text-xs text-slate-400 text-center">
                        +{remainingCount} more suggestion{remainingCount > 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Inline suggestion chip (for embedding in other components)
 */
export interface SuggestionChipProps {
    /** Suggestion to display */
    suggestion: Suggestion;
    /** Click handler */
    onClick?: () => void;
    /** Additional className */
    className?: string;
}

export function SuggestionChip({
    suggestion,
    onClick,
    className,
}: SuggestionChipProps) {
    const config = typeConfig[suggestion.type] || fallbackConfig;
    const Icon = config.icon;

    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
                'transition-colors',
                config.bgClass,
                config.colorClass,
                'hover:opacity-80',
                className
            )}
        >
            <Icon size={10} />
            <span className="truncate max-w-[150px]">{suggestion.title}</span>
            <ChevronRight size={10} className="opacity-50" />
        </button>
    );
}

export default SuggestionPopover;
